//! HTTP metadata lookups with the v1 response cache (`~/.quantex/cache/versions.json`).

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde_json::{Map, Value, json};

use crate::context::{CacheMode, Context, Freshness};
use crate::store;

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
    body: Option<String>,
}

fn user_agent() -> String {
    format!("quantex-cli/{}", crate::VERSION)
}

fn attempt(url: &str, etag: Option<&str>, timeout: Duration) -> Result<Response, String> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(timeout))
        .http_status_as_error(false)
        .user_agent(user_agent())
        .build()
        .into();
    let mut request = agent.get(url);
    if let Some(etag) = etag {
        request = request.header("If-None-Match", etag);
    }
    let mut response = request.call().map_err(|error| error.to_string())?;
    let status = response.status().as_u16();
    let etag = response
        .headers()
        .get("etag")
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let body = if (200..300).contains(&status) {
        let mut text = String::new();
        response
            .body_mut()
            .as_reader()
            .read_to_string(&mut text)
            .map_err(|error| error.to_string())?;
        Some(text)
    } else {
        None
    };
    Ok(Response { status, etag, body })
}

/// GETs `url` with `retries + 1` attempts, each bounded by the per-attempt timeout and
/// the invocation deadline. `None` when every attempt failed.
fn fetch_with_retries(ctx: &Context, url: &str, etag: Option<&str>, timeout_ms: u64, retries: u64) -> Option<Response> {
    let deadline = ctx.deadline();
    for _ in 0..=retries {
        if ctx.is_cancelled() {
            return None;
        }
        let mut timeout = Duration::from_millis(timeout_ms.max(1));
        if let Some(deadline) = deadline {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                ctx.mark_deadline_hit();
                return None;
            }
            timeout = timeout.min(remaining);
        }
        if let Ok(response) = attempt(url, etag, timeout) {
            return Some(response);
        }
    }
    if ctx.deadline_passed() {
        ctx.mark_deadline_hit();
    }
    None
}

/// Fetches `url` through the response cache, as v1's `fetchTextWithCache` did.
pub fn fetch_text_with_cache(ctx: &Context, url: &str, key: &str, expect_json: bool) -> Option<String> {
    fetch_text_with_mode(ctx, url, key, expect_json, ctx.cache_mode)
}

/// `fetch_text_with_cache` with an explicit cache mode instead of the invocation's.
pub fn fetch_text_with_mode(ctx: &Context, url: &str, key: &str, expect_json: bool, mode: CacheMode) -> Option<String> {
    let dir = ctx.quantex_dir();
    let config = store::load_config(&dir);
    let ttl_ms = (config.version_cache_ttl_hours() * 3_600_000) as i64;
    let path = cache_path(&dir);
    let cached = if mode == CacheMode::NoCache {
        None
    } else {
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
    let etag = if mode == CacheMode::NoCache {
        None
    } else {
        cached.as_ref().and_then(|entry| entry.etag.clone())
    };
    let response = fetch_with_retries(
        ctx,
        url,
        etag.as_deref(),
        config.network_timeout_ms(),
        config.network_retries(),
    );
    let fallback = |cached: Option<CachedEntry>| {
        cached.map(|entry| {
            record_cached(ctx, &entry, ttl_ms);
            entry.body
        })
    };
    let Some(response) = response else {
        return fallback(cached);
    };
    if response.status == 304
        && let Some(entry) = &cached
    {
        if mode != CacheMode::NoCache {
            let _guard = CACHE_LOCK.lock().unwrap();
            let mut entries = load_cache(&path);
            entries.insert(
                key.into(),
                json!({ "body": entry.body, "etag": entry.etag, "expiresAt": now + ttl_ms, "fetchedAt": now }),
            );
            save_cache(&path, &entries);
        }
        record_network(ctx, now, now + ttl_ms);
        return Some(entry.body.clone());
    }
    let Some(body) = response.body else {
        return fallback(cached);
    };
    if expect_json && serde_json::from_str::<Value>(&body).is_err() {
        return fallback(cached);
    }
    if mode != CacheMode::NoCache {
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

/// GETs `url` without the cache, bounded only by the invocation deadline.
pub fn download(ctx: &Context, url: &str) -> Result<Vec<u8>, DownloadError> {
    let timeout = match ctx.deadline() {
        Some(deadline) => {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                ctx.mark_deadline_hit();
                return Err(DownloadError::TimedOut);
            }
            Some(remaining)
        }
        None => None,
    };
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(timeout)
        .http_status_as_error(false)
        .user_agent(user_agent())
        .build()
        .into();
    let outcome = agent.get(url).call().and_then(|mut response| {
        let status = response.status().as_u16();
        if !(200..300).contains(&status) {
            return Ok(Err(DownloadError::Status(status)));
        }
        let body = response.body_mut().with_config().limit(DOWNLOAD_LIMIT).read_to_vec()?;
        Ok(Ok(body))
    });
    match outcome {
        Ok(result) => result,
        Err(_) if ctx.deadline_passed() => {
            ctx.mark_deadline_hit();
            Err(DownloadError::TimedOut)
        }
        Err(error) => Err(DownloadError::Failed(error.to_string())),
    }
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
    if ctx.cache_mode == CacheMode::NoCache {
        return;
    }
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
    if ctx.cache_mode == CacheMode::NoCache {
        return None;
    }
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

    #[test]
    fn component_encoding_matches_encode_uri_component() {
        assert_eq!(
            encode_component("@anthropic-ai/claude-code"),
            "%40anthropic-ai%2Fclaude-code"
        );
        assert_eq!(encode_component("latest"), "latest");
    }
}
