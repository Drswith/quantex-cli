//! HTTP metadata lookups with the v1 response cache (`~/.quantex/cache/versions.json`).

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde_json::{Map, Value, json};

use crate::context::{CacheMode, Context, Freshness};
use crate::store;

mod proxy;

pub const OFFICIAL_NPM_REGISTRY: &str = "https://registry.npmjs.org";

/// Serialises read-modify-write of the cache file across worker threads.
static CACHE_LOCK: Mutex<()> = Mutex::new(());

fn cache_path(dir: &Path) -> PathBuf {
    dir.join("cache").join("versions.json")
}

fn load_cache(path: &Path) -> Map<String, Value> {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|value| value.get("entries").and_then(Value::as_object).cloned())
        .unwrap_or_default()
}

fn save_cache(path: &Path, entries: &Map<String, Value>) {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let text = serde_json::to_string_pretty(&json!({ "entries": entries })).unwrap();
    let _ = fs::write(path, format!("{text}\n"));
}

struct CachedEntry {
    body: String,
    etag: Option<String>,
    expires_at: i64,
    fetched_at: Option<i64>,
}

fn parse_entry(value: &Value) -> Option<CachedEntry> {
    let map = value.as_object()?;
    let body = map.get("body")?.as_str()?.to_owned();
    let expires_at = map.get("expiresAt")?.as_i64().filter(|&value| value >= 0)?;
    Some(CachedEntry {
        body,
        etag: map.get("etag").and_then(Value::as_str).map(str::to_owned),
        expires_at,
        fetched_at: map.get("fetchedAt").and_then(Value::as_i64).filter(|&value| value >= 0),
    })
}

fn record_cached(ctx: &Context, entry: &CachedEntry, ttl_ms: i64) {
    let fetched = entry.fetched_at.unwrap_or_else(|| (entry.expires_at - ttl_ms).max(0));
    ctx.record_freshness(Freshness {
        fetched_at: crate::time::format_iso(fetched),
        source: "cache",
        stale_after: crate::time::format_iso(entry.expires_at),
    });
}

fn record_network(ctx: &Context, now: i64, stale_after: i64) {
    ctx.record_freshness(Freshness {
        fetched_at: crate::time::format_iso(now),
        source: "network",
        stale_after: crate::time::format_iso(stale_after),
    });
}

struct Response {
    status: u16,
    etag: Option<String>,
    body: Option<Vec<u8>>,
    retryable: bool,
}

fn user_agent() -> String {
    format!("quantex-cli/{}", crate::VERSION)
}

fn retryable_status(status: u16, remaining: Option<&str>, retry_after: bool) -> bool {
    status == 429 || (500..600).contains(&status) || status == 403 && (remaining == Some("0") || retry_after)
}

fn attempt(
    url: &str,
    etag: Option<&str>,
    timeout: Duration,
    proxy: Option<ureq::Proxy>,
    limit: u64,
) -> Result<Response, String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(timeout))
        .http_status_as_error(false)
        .user_agent(user_agent())
        .proxy(proxy)
        .build()
        .into();
    let mut request = agent.get(url);
    if let Some(etag) = etag {
        request = request.header("If-None-Match", etag);
    }
    // Do not expose request/proxy credentials in transport error strings.
    let mut response = request.call().map_err(|_| "HTTP connection failed".to_owned())?;
    let status = response.status().as_u16();
    let retryable = retryable_status(
        status,
        response
            .headers()
            .get("x-ratelimit-remaining")
            .and_then(|v| v.to_str().ok()),
        response.headers().contains_key("retry-after"),
    );
    let etag = response
        .headers()
        .get("etag")
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let body = if (200..300).contains(&status) {
        Some(
            response
                .body_mut()
                .with_config()
                .limit(limit)
                .read_to_vec()
                .map_err(|_| "HTTP response body could not be read".to_owned())?,
        )
    } else {
        None
    };
    Ok(Response {
        status,
        etag,
        body,
        retryable,
    })
}

/// Bounded GET retries; the current system proxy is discovered only after failure.
/// Provider installers/updaters are never replayed by this HTTP layer.
fn fetch_with_retries(
    ctx: &Context,
    url: &str,
    etag: Option<&str>,
    timeout_ms: u64,
    limit: u64,
) -> Result<Response, String> {
    fetch_with_proxy_lookup(ctx, url, etag, timeout_ms, limit, proxy::system)
}

fn fetch_with_proxy_lookup(
    ctx: &Context,
    url: &str,
    etag: Option<&str>,
    timeout_ms: u64,
    limit: u64,
    discover: impl Fn(&Context, &str) -> Option<ureq::Proxy>,
) -> Result<Response, String> {
    let mut route = proxy::environment(url);
    let mut last_error = "HTTP request failed".to_owned();
    for attempt_no in 0..=store::NETWORK_RETRIES {
        if ctx.is_cancelled() {
            return Err("Request cancelled".into());
        }
        let mut timeout = Duration::from_millis(timeout_ms.max(1));
        if let Some(deadline) = ctx.deadline() {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                ctx.mark_deadline_hit();
                return Err("Request timed out".into());
            }
            timeout = timeout.min(remaining);
        }
        let response = attempt(url, etag, timeout, route.clone(), limit);
        let retry = match &response {
            Ok(response) => response.retryable,
            Err(_) => true,
        };
        if !retry || attempt_no == store::NETWORK_RETRIES {
            if ctx.deadline_passed() {
                ctx.mark_deadline_hit();
            }
            return response;
        }
        let reason = match &response {
            Ok(r) => format!("HTTP {}", r.status),
            Err(e) => e.clone(),
        };
        if attempt_no == 0 {
            if let Some(current) = discover(ctx, url)
                && route.as_ref().is_none_or(|old| old.uri() != current.uri())
            {
                let host = url::Url::parse(url)
                    .ok()
                    .and_then(|u| u.host_str().map(str::to_owned))
                    .unwrap_or_default();
                let previous = if route.is_some() {
                    "configured proxy"
                } else {
                    "direct connection"
                };
                if !ctx.quiet {
                    eprintln!("{host}: {previous} failed ({reason}); retrying through the current system proxy.");
                }
                route = Some(current);
            } else if response.as_ref().is_ok_and(|r| matches!(r.status, 403 | 429)) {
                // Retrying the same rate-limited route immediately cannot help.
                return response;
            }
        } else if response.as_ref().is_ok_and(|r| matches!(r.status, 403 | 429)) {
            return response;
        }
        last_error = reason;
    }
    Err(last_error)
}

/// Uses a fresh cache entry or revalidates it; failed revalidation never serves stale data.
pub fn fetch_text_with_cache(ctx: &Context, url: &str, key: &str, expect_json: bool) -> Option<String> {
    fetch_text_with_mode(ctx, url, key, expect_json, ctx.cache_mode)
}

/// `fetch_text_with_cache` with an explicit cache mode instead of the invocation's.
pub fn fetch_text_with_mode(ctx: &Context, url: &str, key: &str, expect_json: bool, mode: CacheMode) -> Option<String> {
    let dir = ctx.quantex_dir();
    let config = store::load_config(&dir);
    let ttl_ms = (store::VERSION_CACHE_TTL_HOURS * 3_600_000) as i64;
    let path = cache_path(&dir);
    let cached = {
        let _guard = CACHE_LOCK.lock().unwrap();
        load_cache(&path).get(key).and_then(parse_entry)
    };
    let now = crate::time::now_millis();
    if mode == CacheMode::Default
        && let Some(entry) = &cached
        && entry.expires_at > now
    {
        record_cached(ctx, entry, ttl_ms);
        return Some(entry.body.clone());
    }
    let etag = cached.as_ref().and_then(|entry| entry.etag.clone());
    let response = fetch_with_retries(ctx, url, etag.as_deref(), config.network_timeout_ms(), 8 * 1024 * 1024).ok()?;
    if response.status == 304
        && etag.is_some()
        && let Some(entry) = &cached
    {
        let _guard = CACHE_LOCK.lock().unwrap();
        let mut entries = load_cache(&path);
        entries.insert(
            key.into(),
            json!({ "body": entry.body, "etag": entry.etag, "expiresAt": now + ttl_ms, "fetchedAt": now }),
        );
        save_cache(&path, &entries);
        record_network(ctx, now, now + ttl_ms);
        return Some(entry.body.clone());
    }
    let body = String::from_utf8(response.body?).ok()?;
    if expect_json && serde_json::from_str::<Value>(&body).is_err() {
        return None;
    }
    {
        let _guard = CACHE_LOCK.lock().unwrap();
        let mut entries = load_cache(&path);
        let mut entry = Map::new();
        entry.insert("body".into(), body.clone().into());
        if let Some(etag) = &response.etag {
            entry.insert("etag".into(), etag.clone().into());
        }
        entry.insert("expiresAt".into(), (now + ttl_ms).into());
        entry.insert("fetchedAt".into(), now.into());
        entries.insert(key.into(), Value::Object(entry));
        save_cache(&path, &entries);
    }
    record_network(ctx, now, now + ttl_ms);
    Some(body)
}

pub fn fetch_json_with_cache(ctx: &Context, url: &str, key: &str) -> Option<Value> {
    fetch_text_with_cache(ctx, url, key, true).and_then(|body| serde_json::from_str(&body).ok())
}

pub fn fetch_json_with_mode(ctx: &Context, url: &str, key: &str, mode: CacheMode) -> Option<Value> {
    fetch_text_with_mode(ctx, url, key, true, mode).and_then(|body| serde_json::from_str(&body).ok())
}

/// Why a download did not produce a body.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DownloadError {
    Status(u16),
    Failed(String),
    TimedOut,
}

/// Largest release archive a download accepts.
const DOWNLOAD_LIMIT: u64 = 512 * 1024 * 1024;

/// GETs `url` without the cache, with five-minute attempts bounded by the invocation deadline.
pub fn download(ctx: &Context, url: &str) -> Result<Vec<u8>, DownloadError> {
    let response = fetch_with_retries(ctx, url, None, 300_000, DOWNLOAD_LIMIT);
    if ctx.deadline_passed() {
        ctx.mark_deadline_hit();
        return Err(DownloadError::TimedOut);
    }
    let response = response.map_err(DownloadError::Failed)?;
    response.body.ok_or(DownloadError::Status(response.status))
}

/// `encodeURIComponent`.
pub fn encode_component(text: &str) -> String {
    let mut out = String::new();
    for byte in text.bytes() {
        let keep = byte.is_ascii_alphanumeric()
            || matches!(byte, b'-' | b'_' | b'.' | b'!' | b'~' | b'*' | b'\'' | b'(' | b')');
        if keep {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

/// The default npm registry. `QUANTEX_NPM_REGISTRY_URL` exists only so tests can point
/// lookups at a local server.
pub fn npm_registry() -> String {
    std::env::var("QUANTEX_NPM_REGISTRY_URL")
        .ok()
        .and_then(|value| store::normalize_registry_url(&value))
        .unwrap_or_else(|| OFFICIAL_NPM_REGISTRY.to_owned())
}

/// The `version` published under `dist_tag` for an npm package.
pub fn latest_npm_version(ctx: &Context, package: &str, dist_tag: &str, registry: &str) -> Option<String> {
    latest_npm_version_with_mode(ctx, package, dist_tag, registry, ctx.cache_mode)
}

pub fn latest_npm_version_with_mode(
    ctx: &Context,
    package: &str,
    dist_tag: &str,
    registry: &str,
    mode: CacheMode,
) -> Option<String> {
    let registry = store::normalize_registry_url(registry).unwrap_or_else(|| OFFICIAL_NPM_REGISTRY.to_owned());
    let url = format!(
        "{registry}/{}/{}",
        encode_component(package),
        encode_component(dist_tag)
    );
    let key = format!("npm:{registry}:{package}:{dist_tag}");
    fetch_json_with_mode(ctx, &url, &key, mode)?
        .get("version")?
        .as_str()
        .map(str::to_owned)
}

/// Stores a JSON value in the response cache, as v1's version-cache port did.
pub fn cache_write(ctx: &Context, key: &str, value: &Value, expires_at: i64) {
    let path = cache_path(&ctx.quantex_dir());
    let _guard = CACHE_LOCK.lock().unwrap();
    let mut entries = load_cache(&path);
    entries.insert(
        key.into(),
        json!({ "body": value.to_string(), "expiresAt": expires_at, "fetchedAt": crate::time::now_millis() }),
    );
    save_cache(&path, &entries);
}

/// A value `cache_write` stored, while it is fresh.
pub fn cache_read(ctx: &Context, key: &str) -> Option<Value> {
    let path = cache_path(&ctx.quantex_dir());
    let entry = {
        let _guard = CACHE_LOCK.lock().unwrap();
        load_cache(&path).get(key).and_then(parse_entry)?
    };
    if entry.expires_at <= crate::time::now_millis() {
        return None;
    }
    serde_json::from_str(&entry.body).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn server(reply: &str, tunnel: bool) -> (String, std::thread::JoinHandle<()>) {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let reply = reply.to_owned();
        let worker = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
            let request = |stream: &mut std::net::TcpStream| {
                let mut bytes = Vec::new();
                while !bytes.ends_with(b"\r\n\r\n") {
                    let mut byte = [0];
                    stream.read_exact(&mut byte).unwrap();
                    bytes.push(byte[0]);
                }
                String::from_utf8(bytes).unwrap()
            };
            let first = request(&mut stream);
            if tunnel {
                assert!(first.starts_with("CONNECT "), "{first}");
                stream
                    .write_all(b"HTTP/1.1 200 Connection established\r\n\r\n")
                    .unwrap();
                assert!(request(&mut stream).starts_with("GET "));
            }
            stream.write_all(reply.as_bytes()).unwrap();
        });
        (url, worker)
    }

    #[test]
    fn rate_limit_discovers_a_proxy_and_retries_the_actual_request() {
        let (direct, first) = server(
            "HTTP/1.1 403 Forbidden\r\nx-ratelimit-remaining: 0\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            false,
        );
        let (proxy, second) = server(
            "HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: close\r\n\r\nnew",
            true,
        );
        let ctx = Context::resolve(&crate::context::GlobalArgs::default()).unwrap();
        let discoveries = std::cell::Cell::new(0);
        let result = fetch_with_proxy_lookup(&ctx, &direct, None, 2000, 1024, |_, _| {
            discoveries.set(discoveries.get() + 1);
            Some(ureq::Proxy::new(&proxy).unwrap())
        })
        .unwrap();
        assert_eq!(result.status, 200);
        assert_eq!(result.body.unwrap(), b"new");
        assert_eq!(discoveries.get(), 1);
        first.join().unwrap();
        second.join().unwrap();
    }

    #[test]
    fn connection_failure_can_recover_through_a_discovered_proxy() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let offline = format!("http://{}", listener.local_addr().unwrap());
        drop(listener);
        let (proxy, worker) = server(
            "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok",
            true,
        );
        let ctx = Context::resolve(&crate::context::GlobalArgs::default()).unwrap();
        let result = fetch_with_proxy_lookup(&ctx, &offline, None, 2000, 1024, |_, _| {
            Some(ureq::Proxy::new(&proxy).unwrap())
        })
        .unwrap();
        assert_eq!(result.body.unwrap(), b"ok");
        worker.join().unwrap();
    }

    #[test]
    fn ordinary_authentication_failures_do_not_trigger_proxy_retries() {
        for status in [401, 403, 404] {
            let (url, worker) = server(
                &format!("HTTP/1.1 {status} Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"),
                false,
            );
            let ctx = Context::resolve(&crate::context::GlobalArgs::default()).unwrap();
            let result =
                fetch_with_proxy_lookup(&ctx, &url, None, 2000, 1024, |_, _| panic!("not a network failure")).unwrap();
            assert_eq!(result.status, status);
            worker.join().unwrap();
        }
        assert!(retryable_status(429, None, false));
        assert!(retryable_status(503, None, false));
        assert!(retryable_status(403, None, true));
    }

    #[test]
    fn cancelled_or_expired_requests_do_not_start_proxy_discovery() {
        for cancelled in [true, false] {
            let mut args = crate::context::GlobalArgs::default();
            if !cancelled {
                args.timeout = Some("1ms".into());
            }
            let ctx = Context::resolve(&args).unwrap();
            if cancelled {
                ctx.cancel();
            } else {
                std::thread::sleep(Duration::from_millis(5));
            }
            let result = fetch_with_proxy_lookup(&ctx, "http://127.0.0.1:9", None, 2000, 1024, |_, _| {
                panic!("request budget was already exhausted")
            });
            assert!(result.is_err());
        }
    }

    #[test]
    fn component_encoding_matches_encode_uri_component() {
        assert_eq!(
            encode_component("@anthropic-ai/claude-code"),
            "%40anthropic-ai%2Fclaude-code"
        );
        assert_eq!(encode_component("latest"), "latest");
    }
}
