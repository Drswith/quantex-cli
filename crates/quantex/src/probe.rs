//! Executable resolution, version probes, version comparison, installer availability.

use std::cmp::Ordering;
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::catalog::{Agent, Provider};
use crate::context::{Context, home_dir};
use crate::process;

/// Bound for one `--version` probe, so a hung agent cannot stall a whole `list`.
pub const VERSION_PROBE_BUDGET: Duration = Duration::from_secs(15);

/// Directories upstream installers create and add to shell profiles; an agent can
/// live here while the inherited `PATH` still predates the install.
pub fn known_install_dirs() -> Vec<PathBuf> {
    let home = home_dir();
    let env_dir = |key: &str, fallback: PathBuf| {
        std::env::var(key)
            .ok()
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty())
            .map_or(fallback, PathBuf::from)
    };
    let bun = env_dir("BUN_INSTALL", home.join(".bun"));
    let cargo = env_dir("CARGO_HOME", home.join(".cargo"));
    let deno = env_dir("DENO_INSTALL_ROOT", home.join(".deno"));
    let mut dirs = if cfg!(windows) {
        let mut dirs = vec![bun.join("bin"), cargo.join("bin"), deno.join("bin")];
        if let Ok(appdata) = std::env::var("APPDATA")
            && !appdata.trim().is_empty()
        {
            dirs.push(PathBuf::from(appdata.trim()).join("npm"));
        }
        if let Ok(local) = std::env::var("LOCALAPPDATA")
            && !local.trim().is_empty()
        {
            dirs.push(PathBuf::from(local.trim()).join("Programs"));
        }
        dirs
    } else {
        vec![
            home.join(".local").join("bin"),
            home.join("bin"),
            bun.join("bin"),
            cargo.join("bin"),
            deno.join("bin"),
            home.join(".npm-global").join("bin"),
        ]
    };
    let mut seen = Vec::new();
    dirs.retain(|dir| {
        let fresh = !seen.contains(dir);
        seen.push(dir.clone());
        fresh
    });
    dirs
}

/// Names tried for an agent, most specific first. Cursor installs both `agent` and
/// `cursor-agent`; the unique name wins over a colliding `agent` on `PATH`.
pub fn lookup_names(agent: &Agent) -> Vec<String> {
    let mut names = Vec::new();
    if agent.name == "cursor" {
        names.push("cursor-agent".to_owned());
    }
    if !names.contains(&agent.binary_name) {
        names.push(agent.binary_name.clone());
    }
    names
}

/// Resolves each name on `PATH` and then in the known install directories, before
/// moving to the next name.
pub fn resolve_executable(names: &[String]) -> Option<PathBuf> {
    let path_dirs = process::path_dirs();
    let known = known_install_dirs();
    for name in names {
        if let Some(found) = process::find_in(name, &path_dirs) {
            return Some(found);
        }
        if let Some(found) = process::find_in(name, &known) {
            return Some(found);
        }
    }
    None
}

/// `realpath`, without the `\\?\` prefix Windows canonicalisation adds.
pub fn real_path(path: &Path) -> PathBuf {
    match std::fs::canonicalize(path) {
        Ok(resolved) => strip_verbatim(resolved),
        Err(_) => path.to_path_buf(),
    }
}

fn strip_verbatim(path: PathBuf) -> PathBuf {
    let text = path.to_string_lossy();
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{rest}"));
    }
    if let Some(rest) = text.strip_prefix(r"\\?\") {
        return PathBuf::from(rest.to_owned());
    }
    path
}

/// Extracts a version from probe output: the first `x.y.z[-pre]` on the first line,
/// or the whole first line when there is none.
pub fn parse_version_output(text: &str) -> Option<String> {
    let first = text.trim().split('\n').next().unwrap_or_default();
    find_version(first).or_else(|| (!first.is_empty()).then(|| first.trim_end_matches('\r').to_owned()))
}

/// Finds `v?(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)` anywhere in `text`, case-insensitively.
pub fn find_version(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let digits_end = |mut index: usize| {
        let start = index;
        while index < bytes.len() && bytes[index].is_ascii_digit() {
            index += 1;
        }
        (index > start).then_some(index)
    };
    for start in 0..bytes.len() {
        if !bytes[start].is_ascii_digit() || (start > 0 && bytes[start - 1].is_ascii_digit()) {
            continue;
        }
        let Some(a) = digits_end(start) else { continue };
        if bytes.get(a) != Some(&b'.') {
            continue;
        }
        let Some(b) = digits_end(a + 1) else { continue };
        if bytes.get(b) != Some(&b'.') {
            continue;
        }
        let Some(c) = digits_end(b + 1) else { continue };
        let mut end = c;
        if bytes.get(c) == Some(&b'-') {
            let mut index = c + 1;
            while index < bytes.len() && (bytes[index].is_ascii_alphanumeric() || bytes[index] == b'.') {
                index += 1;
            }
            if index > c + 1 {
                end = index;
            }
        }
        return Some(text[start..end].to_owned());
    }
    None
}

/// Runs an agent's version probe. The probe's leading `binaryName` is replaced by the
/// resolved path, so an agent outside `PATH` still answers.
pub fn probe_version(ctx: &Context, agent: &Agent, executable: Option<&Path>) -> Option<String> {
    let command: Vec<String> = agent
        .version_probe
        .as_ref()
        .map(|probe| probe.command.clone())
        .unwrap_or_else(|| vec![agent.binary_name.clone(), "--version".into()]);
    let (program, args) = command.split_first()?;
    let program_path = match executable {
        Some(path) if *program == agent.binary_name => path.to_path_buf(),
        _ => process::which(program)?,
    };
    let budget = ctx
        .remaining()
        .map_or(VERSION_PROBE_BUDGET, |left| left.min(VERSION_PROBE_BUDGET));
    let output = process::run_captured(&program_path, args, Some(budget)).ok()?;
    if output.timed_out && ctx.deadline_passed() {
        ctx.mark_deadline_hit();
    }
    if !output.success() {
        return None;
    }
    parse_version_output(&output.stdout).or_else(|| parse_version_output(&output.stderr))
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedVersion {
    core: [u128; 3],
    prerelease: Vec<String>,
}

fn parse_version(text: &str) -> Option<ParsedVersion> {
    let text = text.trim();
    let text = text.strip_prefix(['v', 'V']).unwrap_or(text);
    let (core, prerelease) = match text.split_once('-') {
        Some((core, pre)) => (core, Some(pre)),
        None => (text, None),
    };
    let parts: Vec<&str> = core.split('.').collect();
    if parts.len() != 3
        || parts
            .iter()
            .any(|part| part.is_empty() || !part.bytes().all(|b| b.is_ascii_digit()))
    {
        return None;
    }
    let prerelease = match prerelease {
        Some(pre) => {
            if pre.is_empty() || !pre.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-') {
                return None;
            }
            pre.split('.').map(str::to_owned).collect()
        }
        None => Vec::new(),
    };
    Some(ParsedVersion {
        core: [parts[0].parse().ok()?, parts[1].parse().ok()?, parts[2].parse().ok()?],
        prerelease,
    })
}

fn compare_prerelease(left: &[String], right: &[String]) -> Ordering {
    if left.is_empty() && right.is_empty() {
        return Ordering::Equal;
    }
    if left.is_empty() {
        return Ordering::Greater;
    }
    if right.is_empty() {
        return Ordering::Less;
    }
    for index in 0..left.len().max(right.len()) {
        let (Some(l), Some(r)) = (left.get(index), right.get(index)) else {
            return if left.len() < right.len() {
                Ordering::Less
            } else {
                Ordering::Greater
            };
        };
        if l == r {
            continue;
        }
        let l_numeric = l.bytes().all(|b| b.is_ascii_digit());
        let r_numeric = r.bytes().all(|b| b.is_ascii_digit());
        match (l_numeric, r_numeric) {
            (true, true) => {
                let order = l.parse::<u128>().unwrap_or(0).cmp(&r.parse::<u128>().unwrap_or(0));
                if order != Ordering::Equal {
                    return order;
                }
            }
            (true, false) => return Ordering::Less,
            (false, true) => return Ordering::Greater,
            (false, false) => return l.as_str().cmp(r.as_str()),
        }
    }
    Ordering::Equal
}

/// v1's lenient semver comparison. `None` when either side does not parse.
pub fn compare_versions(left: &str, right: &str) -> Option<Ordering> {
    let left = parse_version(left)?;
    let right = parse_version(right)?;
    Some(
        left.core
            .cmp(&right.core)
            .then_with(|| compare_prerelease(&left.prerelease, &right.prerelease)),
    )
}

pub fn is_version_newer(candidate: &str, current: &str) -> bool {
    compare_versions(candidate, current) == Some(Ordering::Greater)
}

fn command_succeeds(program: &str, args: &[&str]) -> bool {
    let Some(path) = process::which(program) else {
        return false;
    };
    process::run_captured(&path, args, Some(Duration::from_secs(15))).is_ok_and(|output| output.success())
}

/// Whether a package manager is usable: its `--version` exits 0.
pub fn installer_available(provider: Provider) -> bool {
    match provider {
        Provider::Script => true,
        other => command_succeeds(other.as_str(), &["--version"]),
    }
}

/// Availability of the package managers the catalog uses on this platform, probed in
/// parallel.
pub fn installer_availability() -> Vec<(Provider, bool)> {
    std::thread::scope(|scope| {
        let handles: Vec<_> = crate::catalog::installers()
            .into_iter()
            .map(|provider| scope.spawn(move || (provider, installer_available(provider))))
            .collect();
        handles.into_iter().map(|handle| handle.join().unwrap()).collect()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions_are_found_like_the_v1_pattern() {
        assert_eq!(find_version("claude 2.1.278 (Claude Code)").as_deref(), Some("2.1.278"));
        assert_eq!(find_version("v1.2.3-beta.1 build").as_deref(), Some("1.2.3-beta.1"));
        assert_eq!(find_version("codex-cli 0.48.0").as_deref(), Some("0.48.0"));
        assert_eq!(find_version("no version here"), None);
        assert_eq!(
            parse_version_output("weird-build\nsecond").as_deref(),
            Some("weird-build")
        );
        assert_eq!(parse_version_output("  \n"), None);
    }

    #[test]
    fn comparison_follows_v1_rules() {
        use Ordering::*;
        assert_eq!(compare_versions("1.2.3", "1.2.4"), Some(Less));
        assert_eq!(compare_versions("v2.0.0", "1.99.99"), Some(Greater));
        assert_eq!(compare_versions("1.0.0", "1.0.0-beta"), Some(Greater));
        assert_eq!(compare_versions("1.0.0-alpha.2", "1.0.0-alpha.10"), Some(Less));
        assert_eq!(compare_versions("1.0.0-alpha", "1.0.0-1"), Some(Greater));
        assert_eq!(
            compare_versions("0.0.1792743733-g57207c", "0.0.1792743733-g57207c"),
            Some(Equal)
        );
        assert_eq!(compare_versions("1.2", "1.2.0"), None);
        assert_eq!(compare_versions("1.2.3+build", "1.2.3"), None);
        assert!(is_version_newer("1.10.0", "1.9.9"));
    }

    #[test]
    fn verbatim_prefixes_are_stripped() {
        assert_eq!(
            strip_verbatim(PathBuf::from(r"\\?\C:\Tools\agy.exe")),
            PathBuf::from(r"C:\Tools\agy.exe")
        );
        assert_eq!(
            strip_verbatim(PathBuf::from(r"\\?\UNC\server\share\x")),
            PathBuf::from(r"\\server\share\x")
        );
    }
}
