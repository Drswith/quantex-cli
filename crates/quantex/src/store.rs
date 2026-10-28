//! Files under `~/.quantex`: `config.json`, `state.json`, and directory locks.
//!
//! Every format here is shared with v1.13.6, so a TypeScript build and this build can
//! use the same home directory.

use std::collections::BTreeMap;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use serde_json::{Map, Value, json};

use crate::catalog::Provider;
use crate::protocol::{CommandError, ErrorCode, Target};

// ---------------------------------------------------------------------------
// Config

pub const CONFIG_INTEGER_KEYS: [&str; 3] = ["networkRetries", "networkTimeoutMs", "versionCacheTtlHours"];

pub fn default_config() -> Map<String, Value> {
    let mut map = Map::new();
    map.insert("defaultPackageManager".into(), "bun".into());
    map.insert("networkRetries".into(), 2.into());
    map.insert("networkTimeoutMs".into(), 10000.into());
    map.insert("npmBunUpdateStrategy".into(), "latest-major".into());
    map.insert("selfUpdateChannel".into(), "stable".into());
    map.insert("versionCacheTtlHours".into(), 6.into());
    map
}

/// The effective configuration: defaults, overlaid by `config.json`, normalised.
#[derive(Debug, Clone)]
pub struct Config {
    pub values: Map<String, Value>,
}

impl Config {
    pub fn network_retries(&self) -> u64 {
        self.values["networkRetries"].as_u64().unwrap_or(2)
    }

    pub fn network_timeout_ms(&self) -> u64 {
        self.values["networkTimeoutMs"].as_u64().unwrap_or(10_000)
    }

    pub fn version_cache_ttl_hours(&self) -> u64 {
        self.values["versionCacheTtlHours"].as_u64().unwrap_or(6)
    }

    pub fn default_package_manager(&self) -> &str {
        self.values["defaultPackageManager"].as_str().unwrap_or("bun")
    }

    pub fn npm_bun_update_strategy(&self) -> &str {
        self.values["npmBunUpdateStrategy"].as_str().unwrap_or("latest-major")
    }

    pub fn self_update_channel(&self) -> &str {
        self.values["selfUpdateChannel"].as_str().unwrap_or("stable")
    }

    pub fn self_update_registry(&self) -> Option<&str> {
        self.values.get("selfUpdateRegistry").and_then(Value::as_str)
    }
}

fn positive_integer(value: Option<&Value>, fallback: u64) -> u64 {
    match value {
        Some(Value::Number(number)) => number
            .as_u64()
            .filter(|&n| n > 0 && number.is_u64())
            .unwrap_or(fallback),
        Some(Value::String(text)) => parse_int_prefix(text).filter(|&n| n > 0).unwrap_or(fallback),
        _ => fallback,
    }
}

/// `Number.parseInt(text, 10)` for non-negative values: leading digits after optional
/// whitespace and `+`.
pub fn parse_int_prefix(text: &str) -> Option<u64> {
    let trimmed = text.trim_start();
    let trimmed = trimmed.strip_prefix('+').unwrap_or(trimmed);
    let digits: String = trimmed.chars().take_while(char::is_ascii_digit).collect();
    if digits.is_empty() { None } else { digits.parse().ok() }
}

/// Normalises a registry URL the way v1 did: parse, serialise, drop trailing slashes.
pub fn normalize_registry_url(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    let url = url::Url::parse(trimmed).ok()?;
    Some(url.to_string().trim_end_matches('/').to_owned())
}

fn config_path(dir: &Path) -> PathBuf {
    dir.join("config.json")
}

fn read_user_config(dir: &Path) -> Map<String, Value> {
    fs::read_to_string(config_path(dir))
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|value| match value {
            Value::Object(map) => Some(map),
            _ => None,
        })
        .unwrap_or_default()
}

pub fn load_config(dir: &Path) -> Config {
    let mut values = default_config();
    for (key, value) in read_user_config(dir) {
        values.insert(key, value);
    }
    let manager = values.get("defaultPackageManager").and_then(Value::as_str);
    let manager = if matches!(manager, Some("bun" | "mise" | "npm" | "uv")) {
        manager.unwrap().to_owned()
    } else {
        "bun".to_owned()
    };
    values.insert("defaultPackageManager".into(), manager.into());
    for (key, fallback) in [
        ("networkRetries", 2),
        ("networkTimeoutMs", 10_000),
        ("versionCacheTtlHours", 6),
    ] {
        let normalized = positive_integer(values.get(key), fallback);
        values.insert(key.into(), normalized.into());
    }
    let strategy = if values.get("npmBunUpdateStrategy").and_then(Value::as_str) == Some("respect-semver") {
        "respect-semver"
    } else {
        "latest-major"
    };
    values.insert("npmBunUpdateStrategy".into(), strategy.into());
    let channel = if values.get("selfUpdateChannel").and_then(Value::as_str) == Some("beta") {
        "beta"
    } else {
        "stable"
    };
    values.insert("selfUpdateChannel".into(), channel.into());
    let registry = values
        .get("selfUpdateRegistry")
        .and_then(Value::as_str)
        .and_then(normalize_registry_url);
    match registry {
        Some(registry) => values.insert("selfUpdateRegistry".into(), registry.into()),
        None => values.remove("selfUpdateRegistry"),
    };
    Config { values }
}

pub fn save_config(dir: &Path, values: &Map<String, Value>) -> std::io::Result<()> {
    fs::create_dir_all(dir)?;
    let text = serde_json::to_string_pretty(&Value::Object(values.clone())).unwrap();
    fs::write(config_path(dir), format!("{text}\n"))
}

// ---------------------------------------------------------------------------
// State

pub const STATE_SCHEMA_VERSION: u64 = 2;
pub const RECEIPT_SCHEMA_VERSION: u64 = 1;

/// One `installedAgents` entry: how Quantex installed an agent.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstalledAgent {
    pub agent_name: String,
    pub install_type: Provider,
    pub binary_name: Option<String>,
    pub package_install_args: Option<Vec<String>>,
    pub package_name: Option<String>,
    pub package_target_kind: Option<String>,
    pub command: Option<String>,
}

impl InstalledAgent {
    pub fn to_value(&self) -> Value {
        let mut map = Map::new();
        map.insert("agentName".into(), self.agent_name.clone().into());
        if let Some(binary_name) = &self.binary_name {
            map.insert("binaryName".into(), binary_name.clone().into());
        }
        if let Some(command) = &self.command {
            map.insert("command".into(), command.clone().into());
        }
        map.insert("installType".into(), self.install_type.as_str().into());
        if let Some(args) = &self.package_install_args {
            map.insert("packageInstallArgs".into(), json!(args));
        }
        if let Some(package_name) = &self.package_name {
            map.insert("packageName".into(), package_name.clone().into());
        }
        if let Some(kind) = &self.package_target_kind {
            map.insert("packageTargetKind".into(), kind.clone().into());
        }
        Value::Object(map)
    }
}

/// The whole `state.json` document.
#[derive(Debug, Clone, Default)]
pub struct State {
    pub installed_agents: BTreeMap<String, InstalledAgent>,
    pub lifecycle_receipts: BTreeMap<String, Value>,
    pub self_state: Map<String, Value>,
}

impl State {
    pub fn to_value(&self) -> Value {
        json!({
            "installedAgents": self.installed_agents.iter()
                .map(|(name, agent)| (name.clone(), agent.to_value()))
                .collect::<Map<String, Value>>(),
            "lifecycleReceipts": self.lifecycle_receipts.iter()
                .map(|(name, receipt)| (name.clone(), receipt.clone()))
                .collect::<Map<String, Value>>(),
            "schemaVersion": STATE_SCHEMA_VERSION,
            "self": Value::Object(self.self_state.clone()),
        })
    }

    pub fn install_source(&self) -> Option<&str> {
        self.self_state.get("installSource").and_then(Value::as_str)
    }
}

/// `state.json` could not be read or written.
#[derive(Debug, Clone)]
pub struct StateError {
    pub message: String,
    pub path: PathBuf,
}

impl StateError {
    pub fn into_command_error(self) -> CommandError {
        CommandError::new(ErrorCode::StateReadError, self.message)
            .details(json!({ "stateFilePath": self.path.to_string_lossy() }))
    }
}

pub fn state_path(dir: &Path) -> PathBuf {
    dir.join("state.json")
}

fn schema_error(reason: impl Into<String>) -> String {
    reason.into()
}

fn is_non_empty(value: Option<&Value>) -> Option<&str> {
    value.and_then(Value::as_str).filter(|text| !text.is_empty())
}

fn normalize_installed_agent(name: &str, value: &Value) -> Result<InstalledAgent, String> {
    let Value::Object(map) = value else {
        return Err(schema_error(format!("installed agent \"{name}\" must be an object.")));
    };
    if map.get("agentName").and_then(Value::as_str) != Some(name) {
        return Err(format!("installed agent \"{name}\" has an invalid agentName."));
    }
    let install_type = map
        .get("installType")
        .and_then(Value::as_str)
        .and_then(Provider::parse)
        .ok_or_else(|| format!("installed agent \"{name}\" has an invalid installType."))?;
    let package_name = map.get("packageName").and_then(Value::as_str).map(str::to_owned);
    if package_name.as_deref() == Some("") && install_type.is_managed() {
        return Err(format!("installed agent \"{name}\" has an empty packageName."));
    }
    let package_install_args = map.get("packageInstallArgs").and_then(|value| {
        let items = value.as_array()?;
        items
            .iter()
            .map(|item| item.as_str().map(str::to_owned))
            .collect::<Option<Vec<_>>>()
    });
    let package_target_kind = map
        .get("packageTargetKind")
        .and_then(Value::as_str)
        .filter(|kind| matches!(*kind, "package" | "cask" | "id"))
        .map(str::to_owned);
    Ok(InstalledAgent {
        agent_name: name.to_owned(),
        install_type,
        binary_name: map.get("binaryName").and_then(Value::as_str).map(str::to_owned),
        package_install_args,
        package_name,
        package_target_kind,
        command: map.get("command").and_then(Value::as_str).map(str::to_owned),
    })
}

const PROVIDER_TARGET_KINDS: [&str; 7] = ["binary", "cask", "formula", "id", "package", "script", "tool"];

/// Validates and normalises one lifecycle receipt.
pub fn normalize_receipt(target_id: &str, value: &Value) -> Result<Value, String> {
    let Value::Object(map) = value else {
        return Err(format!("lifecycle receipt \"{target_id}\" must be an object."));
    };
    let fail = |field: &str| format!("lifecycle receipt \"{target_id}\" has an invalid {field}.");
    if map.get("kind").and_then(Value::as_str) != Some("lifecycle-receipt") {
        return Err(fail("kind"));
    }
    if map.get("schemaVersion").and_then(Value::as_u64) != Some(RECEIPT_SCHEMA_VERSION) {
        return Err(format!(
            "lifecycle receipt \"{target_id}\" has an unsupported schemaVersion."
        ));
    }
    if is_non_empty(map.get("targetId")) != Some(target_id) {
        return Err(fail("targetId"));
    }
    let provider_id = is_non_empty(map.get("providerId")).ok_or_else(|| fail("providerId"))?;
    let provider_target_id = is_non_empty(map.get("providerTargetId")).ok_or_else(|| fail("providerTargetId"))?;
    let target_kind = map.get("providerTargetKind");
    if target_kind.is_some_and(|kind| !kind.as_str().is_some_and(|kind| PROVIDER_TARGET_KINDS.contains(&kind))) {
        return Err(fail("providerTargetKind"));
    }
    let verified_at = is_non_empty(map.get("verifiedAt"))
        .filter(|text| crate::time::parse_iso(text).is_some() || looks_like_date(text))
        .ok_or_else(|| fail("verifiedAt"))?;
    let mut receipt = Map::new();
    if let Some(name) = is_non_empty(map.get("executableName")) {
        receipt.insert("executableName".into(), name.into());
    }
    if let Some(path) = is_non_empty(map.get("executablePath")) {
        receipt.insert("executablePath".into(), path.into());
    }
    receipt.insert("kind".into(), "lifecycle-receipt".into());
    receipt.insert("providerId".into(), provider_id.into());
    receipt.insert("providerTargetId".into(), provider_target_id.into());
    if let Some(kind) = target_kind.and_then(Value::as_str) {
        receipt.insert("providerTargetKind".into(), kind.into());
    }
    receipt.insert("schemaVersion".into(), RECEIPT_SCHEMA_VERSION.into());
    receipt.insert("targetId".into(), target_id.into());
    receipt.insert("verifiedAt".into(), verified_at.into());
    if let Some(version) = is_non_empty(map.get("version")) {
        receipt.insert("version".into(), version.into());
    }
    Ok(Value::Object(receipt))
}

/// `Date.parse` accepts more than strict ISO; keep plain `YYYY-MM-DD` and friends.
fn looks_like_date(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() >= 10 && bytes[..4].iter().all(u8::is_ascii_digit) && bytes[4] == b'-' && bytes[7] == b'-'
}

/// Parses a `state.json` value. Returns the state and whether it was a legacy
/// (unversioned) document.
pub fn parse_state(value: &Value) -> Result<(State, bool), String> {
    let Value::Object(map) = value else {
        return Err("root value must be an object.".into());
    };
    let legacy = !map.contains_key("schemaVersion");
    if !legacy && map.get("schemaVersion").and_then(Value::as_u64) != Some(STATE_SCHEMA_VERSION) {
        let shown = match &map["schemaVersion"] {
            Value::String(text) => text.clone(),
            other => other.to_string(),
        };
        return Err(format!("unsupported schemaVersion \"{shown}\"."));
    }
    let mut state = State::default();
    match map.get("installedAgents") {
        None => {}
        Some(Value::Object(agents)) => {
            for (name, agent) in agents {
                state
                    .installed_agents
                    .insert(name.clone(), normalize_installed_agent(name, agent)?);
            }
        }
        Some(_) => return Err("installedAgents must be an object.".into()),
    }
    if !legacy {
        match map.get("lifecycleReceipts") {
            Some(Value::Object(receipts)) => {
                for (target_id, receipt) in receipts {
                    state
                        .lifecycle_receipts
                        .insert(target_id.clone(), normalize_receipt(target_id, receipt)?);
                }
            }
            _ => return Err("lifecycleReceipts must be an object.".into()),
        }
    }
    if let Some(Value::Object(self_map)) = map.get("self") {
        let mut self_state = self_map.clone();
        let valid_source = self_map
            .get("installSource")
            .and_then(Value::as_str)
            .is_some_and(|source| matches!(source, "binary" | "bun" | "npm" | "source" | "unknown"));
        if !valid_source {
            self_state.remove("installSource");
        }
        for key in ["updateNoticeAt", "updateNoticeVersion"] {
            if !self_map.get(key).is_some_and(Value::is_string) {
                self_state.remove(key);
            }
        }
        state.self_state = self_state;
    }
    Ok((state, legacy))
}

/// Loads `state.json`; a missing file is an empty state.
pub fn load_state(dir: &Path) -> Result<State, StateError> {
    let path = state_path(dir);
    let error = |message: String| StateError {
        message,
        path: path.clone(),
    };
    let text = match fs::read_to_string(&path) {
        Ok(text) => text,
        Err(io) if matches!(io.kind(), ErrorKind::NotFound | ErrorKind::NotADirectory) => {
            return Ok(State::default());
        }
        Err(io) => return Err(error(format!("Failed to read Quantex state file: {io}"))),
    };
    let value: Value = serde_json::from_str(&text).map_err(|parse| {
        error(format!(
            "Failed to read Quantex state file: state.json contains invalid JSON: {parse}"
        ))
    })?;
    parse_state(&value)
        .map(|(state, _)| state)
        .map_err(|reason| error(format!("Failed to read Quantex state file: {reason}")))
}

/// Writes `state.json` atomically. A legacy document is first backed up to
/// `state.json.v1.bak`, as v1 did.
pub fn save_state(dir: &Path, state: &State) -> Result<(), StateError> {
    let path = state_path(dir);
    let fail = |message: &str, cause: &dyn std::fmt::Display| StateError {
        message: format!("{message}: {cause}"),
        path: path.clone(),
    };
    fs::create_dir_all(dir).map_err(|io| fail("Failed to write Quantex state file", &io))?;
    let suffix = std::process::id();
    let original = fs::read_to_string(&path).ok();
    if let Some(original) = &original
        && let Ok(value) = serde_json::from_str::<Value>(original)
        && matches!(parse_state(&value), Ok((_, true)))
    {
        let backup = dir.join("state.json.v1.bak");
        let backup_temp = dir.join(format!("state.json.v1.bak.tmp-{suffix}"));
        fs::write(&backup_temp, original).map_err(|io| fail("Failed to back up Quantex state file", &io))?;
        fs::rename(&backup_temp, &backup).map_err(|io| fail("Failed to back up Quantex state file", &io))?;
    }
    let payload = format!("{}\n", serde_json::to_string_pretty(&state.to_value()).unwrap());
    let temp = dir.join(format!("state.json.tmp-{suffix}"));
    let result = fs::write(&temp, &payload).and_then(|()| fs::rename(&temp, &path));
    if let Err(io) = result {
        let _ = fs::remove_file(&temp);
        return Err(fail("Failed to write Quantex state file", &io));
    }
    Ok(())
}

/// Loads, changes, and saves `state.json` under the state lock.
pub fn mutate_state<F>(dir: &Path, change: F) -> Result<State, MutateError>
where
    F: FnOnce(&mut State),
{
    let _lock = acquire_lock(dir, "state", &["state"]).map_err(MutateError::Locked)?;
    let mut state = load_state(dir).map_err(MutateError::State)?;
    change(&mut state);
    save_state(dir, &state).map_err(MutateError::State)?;
    Ok(state)
}

#[derive(Debug)]
pub enum MutateError {
    Locked(LockError),
    State(StateError),
}

impl MutateError {
    pub fn into_command_error(self) -> CommandError {
        match self {
            Self::Locked(error) => error.into_command_error(),
            Self::State(error) => error.into_command_error(),
        }
    }
}

// ---------------------------------------------------------------------------
// Locks

/// Another process holds a resource lock.
#[derive(Debug, Clone)]
pub struct LockError {
    pub resource: String,
    pub path: PathBuf,
    pub io: Option<String>,
}

impl LockError {
    pub fn into_command_error(self) -> CommandError {
        let message = self
            .io
            .clone()
            .unwrap_or_else(|| format!("Another quantex process is already using the {} lock.", self.resource));
        CommandError::new(ErrorCode::ResourceLocked, message).details(json!({
            "lockPath": self.path.to_string_lossy(),
            "resource": self.resource,
        }))
    }

    pub fn into_outcome_error(self, _target: Option<&Target>) -> CommandError {
        self.into_command_error()
    }
}

/// Releases the lock directory when dropped.
#[derive(Debug)]
pub struct LockGuard {
    path: PathBuf,
}

impl Drop for LockGuard {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn sanitize_segment(segment: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;
    for c in segment.trim().chars() {
        let keep = c.is_ascii_alphanumeric() || c == '_' || c == '.' || c == '-';
        if keep && c != '-' {
            out.push(c);
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    out.trim_matches('-').to_owned()
}

pub fn lock_path(dir: &Path, scope: &[&str]) -> PathBuf {
    let segments: Vec<String> = scope
        .iter()
        .map(|segment| sanitize_segment(segment))
        .filter(|segment| !segment.is_empty())
        .collect();
    let segments = if segments.is_empty() {
        vec!["default".to_owned()]
    } else {
        segments
    };
    let mut path = dir.join("locks");
    for segment in &segments[..segments.len() - 1] {
        path.push(segment);
    }
    path.push(format!("{}.lock", segments[segments.len() - 1]));
    path
}

fn write_owner(path: &Path) -> std::io::Result<()> {
    let owner = json!({ "pid": std::process::id(), "createdAt": crate::time::now_iso() });
    fs::write(
        path.join("owner.json"),
        format!("{}\n", serde_json::to_string(&owner).unwrap()),
    )
}

fn read_owner_pid(path: &Path) -> Result<Option<u32>, ()> {
    match fs::read_to_string(path.join("owner.json")) {
        Ok(text) => {
            let value: Value = serde_json::from_str(&text).map_err(|_| ())?;
            Ok(value
                .get("pid")
                .and_then(Value::as_u64)
                .filter(|&pid| pid > 0)
                .and_then(|pid| u32::try_from(pid).ok()))
        }
        Err(io) if matches!(io.kind(), ErrorKind::NotFound | ErrorKind::NotADirectory) => Ok(None),
        Err(_) => Err(()),
    }
}

/// Removes a lock whose owner is gone. Unreadable owner metadata is never removed.
fn remove_stale_lock(path: &Path) -> bool {
    let deadline = Instant::now() + Duration::from_millis(100);
    let owner = loop {
        match read_owner_pid(path) {
            Ok(Some(pid)) => break Some(pid),
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(2)),
            Ok(None) => break None,
            Err(()) => return false,
        }
    };
    if owner.is_some_and(process_alive) {
        return false;
    }
    let _ = fs::remove_dir_all(path);
    true
}

/// Acquires `~/.quantex/locks/<scope>.lock`, failing at once if a live process holds it.
pub fn acquire_lock(dir: &Path, resource: &str, scope: &[&str]) -> Result<LockGuard, LockError> {
    let path = lock_path(dir, scope);
    let error = |io: Option<String>| LockError {
        resource: resource.to_owned(),
        path: path.clone(),
        io,
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|io| error(Some(io.to_string())))?;
    }
    let attempt = || -> std::io::Result<()> {
        fs::create_dir(&path)?;
        write_owner(&path)
    };
    match attempt() {
        Ok(()) => return Ok(LockGuard { path }),
        Err(io) if io.kind() == ErrorKind::AlreadyExists => {}
        Err(io) => return Err(error(Some(io.to_string()))),
    }
    if !remove_stale_lock(&path) {
        return Err(error(None));
    }
    match attempt() {
        Ok(()) => Ok(LockGuard { path }),
        Err(io) if io.kind() == ErrorKind::AlreadyExists => Err(error(None)),
        Err(io) => Err(error(Some(io.to_string()))),
    }
}

#[cfg(unix)]
pub fn process_alive(pid: u32) -> bool {
    // SAFETY: kill(pid, 0) only checks for existence and permission.
    let result = unsafe { libc::kill(pid as libc::pid_t, 0) };
    result == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

#[cfg(windows)]
pub fn process_alive(pid: u32) -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, STILL_ACTIVE};
    use windows_sys::Win32::System::Threading::{GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
    // SAFETY: plain Win32 calls; the handle is closed before returning.
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return false;
        }
        let mut code = 0u32;
        let ok = GetExitCodeProcess(handle, &mut code);
        CloseHandle(handle);
        ok != 0 && code == STILL_ACTIVE as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_normalises_like_v1() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            dir.path().join("config.json"),
            r#"{"networkRetries":0,"networkTimeoutMs":"250","defaultPackageManager":"pnpm","custom":true}"#,
        )
        .unwrap();
        let config = load_config(dir.path());
        assert_eq!(config.network_retries(), 2, "zero falls back to the default");
        assert_eq!(config.network_timeout_ms(), 250);
        assert_eq!(config.default_package_manager(), "bun");
        assert_eq!(config.values["custom"], true);
        assert!(!config.values.contains_key("selfUpdateRegistry"));
    }

    #[test]
    fn registry_urls_normalise() {
        assert_eq!(
            normalize_registry_url(" https://registry.npmjs.org/ ").as_deref(),
            Some("https://registry.npmjs.org")
        );
        assert_eq!(
            normalize_registry_url("HTTPS://Example.COM/npm//").as_deref(),
            Some("https://example.com/npm")
        );
        assert_eq!(normalize_registry_url("not a url"), None);
    }

    #[test]
    fn contract_state_fixtures_parse() {
        let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../contract/fixtures/state");
        for name in ["valid.json", "ghost.json", "untracked.json"] {
            let text = fs::read_to_string(fixtures.join(name)).unwrap();
            let value: Value = serde_json::from_str(&text).unwrap();
            let (state, legacy) = parse_state(&value).unwrap();
            assert!(legacy, "{name} is a legacy document");
            let _ = state;
        }
        let corrupt = fs::read_to_string(fixtures.join("corrupt.txt")).unwrap();
        assert!(serde_json::from_str::<Value>(&corrupt).is_err());
    }

    #[test]
    fn future_schema_versions_are_rejected() {
        let error = parse_state(&json!({ "schemaVersion": 3 })).unwrap_err();
        assert_eq!(error, "unsupported schemaVersion \"3\".");
    }

    #[test]
    fn legacy_state_is_backed_up_on_first_write() {
        let dir = tempfile::tempdir().unwrap();
        let legacy = r#"{"installedAgents":{"codex":{"agentName":"codex","installType":"npm","packageName":"@openai/codex"}},"self":{}}"#;
        fs::write(dir.path().join("state.json"), legacy).unwrap();
        let state = load_state(dir.path()).unwrap();
        save_state(dir.path(), &state).unwrap();
        assert_eq!(
            fs::read_to_string(dir.path().join("state.json.v1.bak")).unwrap(),
            legacy
        );
        let saved: Value = serde_json::from_str(&fs::read_to_string(dir.path().join("state.json")).unwrap()).unwrap();
        assert_eq!(saved["schemaVersion"], 2);
        assert_eq!(saved["installedAgents"]["codex"]["packageName"], "@openai/codex");
        assert_eq!(saved["lifecycleReceipts"], json!({}));
    }

    #[test]
    fn locks_are_exclusive_and_released_on_drop() {
        let dir = tempfile::tempdir().unwrap();
        let guard = acquire_lock(dir.path(), "state", &["state"]).unwrap();
        assert!(dir.path().join("locks/state.lock/owner.json").exists());
        let error = acquire_lock(dir.path(), "state", &["state"]).unwrap_err();
        assert_eq!(
            error.into_command_error().message,
            "Another quantex process is already using the state lock."
        );
        drop(guard);
        assert!(acquire_lock(dir.path(), "state", &["state"]).is_ok());
    }

    #[test]
    fn stale_locks_from_dead_processes_are_reclaimed() {
        let dir = tempfile::tempdir().unwrap();
        let path = lock_path(dir.path(), &["state"]);
        fs::create_dir_all(&path).unwrap();
        fs::write(
            path.join("owner.json"),
            r#"{"pid":999999999,"createdAt":"2026-01-01T00:00:00.000Z"}"#,
        )
        .unwrap();
        assert!(acquire_lock(dir.path(), "state", &["state"]).is_ok());
    }

    #[test]
    fn lock_paths_sanitise_scopes() {
        let dir = Path::new("/home");
        assert_eq!(
            lock_path(dir, &["agent", "Claude Code!"]),
            dir.join("locks/agent/Claude-Code.lock")
        );
        assert_eq!(lock_path(dir, &[]), dir.join("locks/default.lock"));
    }
}
