//! Request-local proxy selection. Never changes environment variables or persistent settings.
use std::net::IpAddr;
use std::time::Duration;

use crate::context::Context;

fn private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => ip.is_private() || ip.is_loopback() || ip.is_link_local() || ip.is_unspecified(),
        IpAddr::V6(ip) => {
            ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
                || ip.to_ipv4_mapped().is_some_and(|ip| private_ip(ip.into()))
        }
    }
}

fn rule_matches(host: &str, port: Option<u16>, rule: &str) -> bool {
    let rule = rule.trim().to_ascii_lowercase();
    if rule == "*" || rule == "<local>" && !host.contains('.') {
        return true;
    }
    if let Some((network, bits)) = rule.split_once('/') {
        return match (host.parse::<IpAddr>(), network.parse::<IpAddr>(), bits.parse::<u32>()) {
            (Ok(IpAddr::V4(ip)), Ok(IpAddr::V4(net)), Ok(bits)) if bits <= 32 => {
                let mask = u32::MAX.checked_shl(32 - bits).unwrap_or(0);
                u32::from(ip) & mask == u32::from(net) & mask
            }
            (Ok(IpAddr::V6(ip)), Ok(IpAddr::V6(net)), Ok(bits)) if bits <= 128 => {
                let mask = u128::MAX.checked_shl(128 - bits).unwrap_or(0);
                u128::from(ip) & mask == u128::from(net) & mask
            }
            _ => false,
        };
    }
    let mut rule = rule.as_str();
    // A bare IPv6 literal is not a host:port pair.
    if rule.matches(':').count() == 1
        && let Some((name, number)) = rule.rsplit_once(':')
    {
        if number.parse::<u16>().ok() != port {
            return false;
        }
        rule = name;
    }
    let rule = rule
        .trim_matches(['[', ']'])
        .trim_start_matches('*')
        .trim_start_matches('.');
    !rule.is_empty() && (host == rule || host.ends_with(&format!(".{rule}")))
}

fn bypass(url: &url::Url, rules: &str, hosts: &str) -> bool {
    let host = url
        .host_str()
        .unwrap_or_default()
        .trim_matches(['[', ']'])
        .trim_end_matches('.')
        .to_ascii_lowercase();
    if host.parse::<IpAddr>().is_ok_and(private_ip)
        || !host.contains('.') && !host.contains(':')
        || [
            ".localhost",
            ".local",
            ".internal",
            ".lan",
            ".home.arpa",
            ".svc",
            ".cluster.local",
        ]
        .iter()
        .any(|suffix| host.ends_with(suffix))
        || rules
            .split(',')
            .any(|rule| rule_matches(&host, url.port_or_known_default(), rule))
    {
        return true;
    }
    hosts.lines().any(|line| {
        let mut fields = line.split('#').next().unwrap_or_default().split_whitespace();
        fields
            .next()
            .and_then(|ip| ip.parse::<IpAddr>().ok())
            .is_some_and(private_ip)
            && fields.any(|name| name.eq_ignore_ascii_case(&host))
    })
}

fn hosts() -> String {
    #[cfg(windows)]
    let path = std::path::PathBuf::from(std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into()))
        .join("System32/drivers/etc/hosts");
    #[cfg(not(windows))]
    let path = std::path::PathBuf::from("/etc/hosts");
    std::fs::read_to_string(path).unwrap_or_default()
}

fn env_rules() -> String {
    ["NO_PROXY", "no_proxy"]
        .iter()
        .filter_map(|key| std::env::var(key).ok())
        .collect::<Vec<_>>()
        .join(",")
}

pub(super) fn environment(url: &str) -> Option<ureq::Proxy> {
    let url = url::Url::parse(url).ok()?;
    if bypass(&url, &env_rules(), &hosts()) {
        return None;
    }
    let keys = if url.scheme() == "https" {
        ["https_proxy", "HTTPS_PROXY", "all_proxy", "ALL_PROXY"]
    } else {
        ["http_proxy", "HTTP_PROXY", "all_proxy", "ALL_PROXY"]
    };
    keys.iter()
        .filter_map(|key| std::env::var(key).ok())
        .find_map(|value| ureq::Proxy::new(&value).ok())
}

/// Only invoked after a retryable network failure. PAC scripts and port scanning are not used.
pub(super) fn system(ctx: &Context, target: &str) -> Option<ureq::Proxy> {
    let url = url::Url::parse(target).ok()?;
    if bypass(&url, &env_rules(), &hosts()) || ctx.is_cancelled() {
        return None;
    }
    let budget = ctx
        .remaining()
        .unwrap_or(Duration::from_secs(2))
        .min(Duration::from_secs(2));
    if budget.is_zero() {
        return None;
    }
    #[cfg(target_os = "macos")]
    {
        let output =
            crate::process::run_captured(std::path::Path::new("/usr/sbin/scutil"), ["--proxy"], Some(budget)).ok()?;
        if output.code != Some(0) {
            return None;
        }
        from_scutil(&url, &output.stdout, &env_rules(), &hosts())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = budget;
        None
    }
}

#[cfg(any(target_os = "macos", test))]
fn from_scutil(url: &url::Url, text: &str, rules: &str, hosts: &str) -> Option<ureq::Proxy> {
    let field = |key: &str| {
        text.lines().find_map(|line| {
            let (name, value) = line.trim().split_once(" : ")?;
            (name == key).then(|| value.trim())
        })
    };
    let exceptions = text
        .split("ExceptionsList : <array> {")
        .nth(1)
        .and_then(|s| s.split('}').next())
        .map(|s| {
            s.lines()
                .filter_map(|l| l.split_once(" : ").map(|(_, v)| v.trim()))
                .collect::<Vec<_>>()
                .join(",")
        })
        .unwrap_or_default();
    if bypass(url, &format!("{rules},{exceptions}"), hosts) {
        return None;
    }
    let prefix = if url.scheme() == "https" { "HTTPS" } else { "HTTP" };
    if field(&format!("{prefix}Enable")) != Some("1") {
        return None;
    }
    let host = field(&format!("{prefix}Proxy"))?;
    let port = field(&format!("{prefix}Port"))?
        .parse::<u16>()
        .ok()
        .filter(|p| *p != 0)?;
    // The explicit configured port is required; never guess one or persist it.
    ureq::Proxy::builder(ureq::ProxyProtocol::Http)
        .host(host)
        .port(port)
        .build()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bypasses_private_hosts_no_proxy_and_hosts_overrides() {
        for target in [
            "http://localhost",
            "http://127.0.0.1",
            "http://10.1.2.3",
            "http://[::1]",
            "http://[fd00::1]",
            "http://printer",
            "http://api.svc.cluster.local",
        ] {
            assert!(bypass(&url::Url::parse(target).unwrap(), "", ""), "{target}");
        }
        let public = url::Url::parse("https://api.example.com").unwrap();
        assert!(!bypass(&public, "", ""));
        assert!(bypass(&public, ".example.com", ""));
        assert!(bypass(&public, "api.example.com:443", ""));
        assert!(!bypass(&public, "api.example.com:80", ""));
        assert!(bypass(&public, "", "10.1.2.3 api.example.com # local mapping"));
        assert!(bypass(
            &url::Url::parse("http://203.0.113.8").unwrap(),
            "203.0.113.0/24",
            ""
        ));
    }
    #[test]
    fn reads_current_scutil_ports_and_exclusions_without_guessing() {
        let url = url::Url::parse("https://api.github.com").unwrap();
        for port in [18243, 24681] {
            let text = format!("HTTPSEnable : 1\nHTTPSProxy : 127.0.0.1\nHTTPSPort : {port}\n");
            assert_eq!(from_scutil(&url, &text, "", "").unwrap().port(), port);
            assert!(from_scutil(&url, &text, "github.com", "").is_none());
            assert!(from_scutil(&url, &text.replace("Enable : 1", "Enable : 0"), "", "").is_none());
            assert!(from_scutil(&url, &text.replace(&format!("HTTPSPort : {port}"), ""), "", "").is_none());
            assert!(
                from_scutil(
                    &url,
                    &format!("{text}ExceptionsList : <array> {{\n 0 : *.github.com\n}}"),
                    "",
                    ""
                )
                .is_none()
            );
        }
        assert!(from_scutil(&url, "ProxyAutoConfigEnable : 1", "", "").is_none());
    }
}
