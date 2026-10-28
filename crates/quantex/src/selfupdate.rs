//! This Quantex install: where it came from, the newest version it can move to, and
//! the upgrade itself (standalone binary swap, or npm / Bun reinstall).

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use crate::context::{CacheMode, Context};
use crate::{archive, net, probe, process, providers, store};

pub const PACKAGE_NAME: &str = "quantex-cli";
pub const REPOSITORY_URL: &str = "https://github.com/Drswith/quantex-cli";
const LOCK_RESOURCE: &str = "self upgrade";
const METADATA_SCHEMA_VERSION: i64 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallSource {
    Binary,
    Bun,
    Npm,
    Source,
    Unknown,
}

impl InstallSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Binary => "binary",
            Self::Bun => "bun",
            Self::Npm => "npm",
            Self::Source => "source",
            Self::Unknown => "unknown",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        Some(match text {
            "binary" => Self::Binary,
            "bun" => Self::Bun,
            "npm" => Self::Npm,
            "source" => Self::Source,
            "unknown" => Self::Unknown,
            _ => return None,
        })
    }

    pub fn can_auto_update(self) -> bool {
        matches!(self, Self::Binary | Self::Bun | Self::Npm)
    }

    fn managed(self) -> bool {
        matches!(self, Self::Bun | Self::Npm)
    }
}

/// The executable this process runs from, with symlinks followed.
pub fn executable_path() -> PathBuf {
    std::env::current_exe()
        .map(|path| probe::real_path(&path))
        .unwrap_or_default()
}

/// Classifies an executable path. npm and Bun installs run from a platform package
/// under the global `node_modules`; a Cargo build directory is a source checkout.
pub fn detect_install_source(executable: &Path) -> InstallSource {
    let normalized = executable.to_string_lossy().replace('\\', "/").to_lowercase();
    if normalized.contains("/.bun/install/global/") {
        return InstallSource::Bun;
    }
    if normalized.contains(&format!("/node_modules/{PACKAGE_NAME}")) {
        return InstallSource::Npm;
    }
    if normalized.contains("/target/debug/") || normalized.contains("/target/release/") {
        return InstallSource::Source;
    }
    InstallSource::Binary
}

/// The stable / beta channel: `--channel`, then `QUANTEX_UPDATE_CHANNEL`, then config.
pub fn update_channel(requested: Option<&str>, configured: &str) -> &'static str {
    match requested {
        Some("beta") => return "beta",
        Some("stable") => return "stable",
        _ => {}
    }
    match std::env::var("QUANTEX_UPDATE_CHANNEL").as_deref() {
        Ok("beta") => return "beta",
        Ok("stable") => return "stable",
        _ => {}
    }
    if configured == "beta" { "beta" } else { "stable" }
}

#[derive(Debug, Clone)]
pub struct Facts {
    pub install_source: InstallSource,
    pub current_version: &'static str,
    pub executable_path: PathBuf,
    pub update_channel: &'static str,
}

impl Facts {
    pub fn can_auto_update(&self) -> bool {
        self.install_source.can_auto_update()
    }

    fn package_tag(&self) -> &'static str {
        if self.update_channel == "beta" {
            "beta"
        } else {
            "latest"
        }
    }
}

/// Detects the install source; a stored source is used only when detection fails.
pub fn facts(ctx: &Context, requested_channel: Option<&str>) -> Facts {
    let dir = ctx.quantex_dir();
    let executable = executable_path();
    let detected = detect_install_source(&executable);
    let stored = store::load_state(&dir)
        .ok()
        .and_then(|state| state.install_source().and_then(InstallSource::parse));
    let install_source = if detected == InstallSource::Unknown {
        stored.unwrap_or(detected)
    } else {
        detected
    };
    let config = store::load_config(&dir);
    Facts {
        install_source,
        current_version: crate::VERSION,
        executable_path: executable,
        update_channel: update_channel(requested_channel, config.self_update_channel()),
    }
}

/// `facts`, recording a newly detected install source in `state.json` as v1 did
/// before an upgrade.
fn reconciled_facts(ctx: &Context, requested_channel: Option<&str>) -> Facts {
    let facts = facts(ctx, requested_channel);
    let detected = detect_install_source(&facts.executable_path);
    let stored = store::load_state(&ctx.quantex_dir())
        .ok()
        .and_then(|state| state.install_source().map(str::to_owned));
    if detected != InstallSource::Unknown && stored.as_deref() != Some(detected.as_str()) {
        let _ = store::mutate_state(&ctx.quantex_dir(), |state| {
            state
                .self_state
                .insert("installSource".into(), detected.as_str().into());
        });
    }
    facts
}

/// The release archive name for this platform, e.g. `quantex-darwin-arm64.tar.gz`.
pub fn release_asset_name() -> String {
    let binary = if cfg!(windows) {
        "quantex-windows-x64.exe"
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "quantex-darwin-arm64"
        } else {
            "quantex-darwin-x64"
        }
    } else if cfg!(target_arch = "aarch64") {
        "quantex-linux-arm64"
    } else {
        "quantex-linux-x64"
    };
    archive::archive_name(binary)
}

/// Node's `process.platform` / `process.arch` names, as release manifests use them.
pub fn manifest_platform() -> (&'static str, &'static str) {
    let platform = if cfg!(windows) {
        "win32"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };
    let arch = if cfg!(target_arch = "aarch64") { "arm64" } else { "x64" };
    (platform, arch)
}

/// Base URL release downloads come from. `QUANTEX_RELEASE_BASE_URL` exists only so
/// tests can serve a manifest locally.
pub fn release_base_url() -> String {
    std::env::var("QUANTEX_RELEASE_BASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.trim_end_matches('/').to_owned())
        .unwrap_or_else(|| format!("{REPOSITORY_URL}/releases/latest/download"))
}

/// The release manifest for a channel: the latest release for stable, the newest
/// prerelease for beta.
pub fn fetch_manifest(ctx: &Context, channel: &str, mode: CacheMode) -> Option<Value> {
    let url = if channel == "stable" {
        format!("{}/manifest.json", release_base_url())
    } else {
        let releases = net::fetch_json_with_mode(
            ctx,
            "https://api.github.com/repos/Drswith/quantex-cli/releases?per_page=20",
            "self:github-releases",
            mode,
        )?;
        let release = releases
            .as_array()?
            .iter()
            .find(|release| release["prerelease"].as_bool() == Some(channel == "beta"))?;
        release["assets"]
            .as_array()?
            .iter()
            .find(|asset| asset["name"] == "manifest.json")?["browser_download_url"]
            .as_str()?
            .to_owned()
    };
    net::fetch_json_with_mode(ctx, &url, &format!("self:manifest:{channel}"), mode)
}

// ---------------------------------------------------------------------------
// Registry for npm and Bun installs

/// v1 `resolveManagedSelfUpdateRegistry`: the registry an npm or Bun reinstall uses,
/// and whether the user chose it for Quantex specifically.
fn managed_registry(source: InstallSource, config: &store::Config) -> Option<(String, bool)> {
    if !source.managed() {
        return None;
    }
    let env = |key: &str| {
        std::env::var(key)
            .ok()
            .and_then(|value| store::normalize_registry_url(&value))
    };
    if let Some(registry) = env("QTX_SELF_UPDATE_REGISTRY") {
        return Some((registry, true));
    }
    if let Some(registry) = config.self_update_registry() {
        return Some((registry.to_owned(), true));
    }
    let home = crate::context::home_dir();
    let cwd = std::env::current_dir().ok();
    let nearest = |name: &str| {
        let mut dir = cwd.clone()?;
        loop {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
            if !dir.pop() {
                return None;
            }
        }
    };
    if source == InstallSource::Bun {
        let from_env = ["BUN_CONFIG_REGISTRY", "NPM_CONFIG_REGISTRY", "npm_config_registry"]
            .iter()
            .find_map(|key| env(key));
        if let Some(registry) = from_env {
            return Some((registry, false));
        }
        let mut bunfigs: Vec<PathBuf> = nearest("bunfig.toml").into_iter().collect();
        bunfigs.push(home.join(".bunfig.toml"));
        if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
            bunfigs.push(PathBuf::from(xdg).join(".bunfig.toml"));
        }
        let from_bunfig = bunfigs
            .iter()
            .filter_map(|path| fs::read_to_string(path).ok())
            .find_map(|text| bunfig_registry(&text));
        if let Some(registry) = from_bunfig {
            return Some((registry, false));
        }
    }
    if let Some(registry) = ["NPM_CONFIG_REGISTRY", "npm_config_registry"]
        .iter()
        .find_map(|key| env(key))
    {
        return Some((registry, false));
    }
    let npmrcs: Vec<PathBuf> = nearest(".npmrc")
        .into_iter()
        .chain(std::iter::once(home.join(".npmrc")))
        .collect();
    if let Some(registry) = npmrcs
        .iter()
        .filter_map(|path| fs::read_to_string(path).ok())
        .find_map(|text| npmrc_registry(&text))
    {
        return Some((registry, false));
    }
    Some((net::npm_registry(), false))
}

/// The last `registry=` line of an `.npmrc`.
fn npmrc_registry(text: &str) -> Option<String> {
    text.lines().rev().map(str::trim).find_map(|line| {
        if line.is_empty() || line.starts_with('#') || line.starts_with(';') {
            return None;
        }
        let value = line.strip_prefix("registry")?.trim_start().strip_prefix('=')?;
        store::normalize_registry_url(value.trim())
    })
}

/// The first quoted string after `key =` (or `key = { url =`) in `text`.
fn quoted_after(text: &str, key: &str) -> Option<String> {
    let mut rest = text;
    while let Some(index) = rest.find(key) {
        let after = rest[index + key.len()..].trim_start();
        rest = &rest[index + key.len()..];
        let Some(value) = after.strip_prefix('=') else { continue };
        let mut value = value.trim_start();
        if let Some(table) = value.strip_prefix('{') {
            let Some(url) = table.trim_start().strip_prefix("url") else {
                continue;
            };
            let Some(url) = url.trim_start().strip_prefix('=') else {
                continue;
            };
            value = url.trim_start();
        }
        let quote = value.chars().next().filter(|quote| *quote == '"' || *quote == '\'')?;
        let end = value[1..].find(quote)?;
        let url = &value[1..=end];
        if !url.contains('#') && !url.contains('\n') {
            return Some(url.to_owned());
        }
    }
    None
}

/// v1 `parseBunfigRegistryValue`: `install.registry`, an inline `install` table, or the
/// `[install]` section.
fn bunfig_registry(text: &str) -> Option<String> {
    if let Some(url) = quoted_after(text, "install.registry") {
        return store::normalize_registry_url(&url);
    }
    for line in text.lines() {
        let line = line.trim();
        if let Some(table) = line.strip_prefix("install")
            && table.trim_start().starts_with('=')
            && let Some(url) = quoted_after(table, "registry")
        {
            return store::normalize_registry_url(&url);
        }
    }
    let section = text.split("[install]").nth(1)?;
    let section = section
        .lines()
        .take_while(|line| !line.trim_start().starts_with('['))
        .collect::<Vec<_>>()
        .join("\n");
    store::normalize_registry_url(&quoted_after(&section, "registry")?)
}

// ---------------------------------------------------------------------------
// Planning

/// What the newest available Quantex is and where it would come from.
#[derive(Debug, Clone, Default)]
pub struct Target {
    pub latest_version: Option<String>,
    pub upstream_latest_version: Option<String>,
    pub managed_registry: Option<String>,
    /// The manifest asset for this platform, for a standalone binary.
    asset: Option<Value>,
    resolution_error: Option<UpgradeError>,
}

/// v1 `resolveSelfUpdateTarget`.
fn resolve_target(ctx: &Context, facts: &Facts, mode: CacheMode) -> Target {
    if facts.install_source == InstallSource::Binary {
        let channel = facts.update_channel;
        let Some(manifest) = fetch_manifest(ctx, channel, mode) else {
            return Target {
                resolution_error: Some(UpgradeError::new(
                    "network",
                    format!("Failed to resolve the {channel} release manifest."),
                )),
                ..Target::default()
            };
        };
        let (platform, arch) = manifest_platform();
        let expected = release_asset_name();
        let asset = manifest["assets"].as_array().and_then(|assets| {
            assets
                .iter()
                .find(|asset| {
                    asset["platform"] == platform && asset["arch"] == arch && asset["name"] == expected.as_str()
                })
                .cloned()
        });
        return match asset {
            Some(asset) => Target {
                latest_version: manifest["version"].as_str().map(str::to_owned),
                asset: Some(asset),
                ..Target::default()
            },
            None => Target {
                resolution_error: Some(UpgradeError::new(
                    "unsupported",
                    format!("No binary asset is available for the current platform on the {channel} channel."),
                )),
                ..Target::default()
            },
        };
    }
    let tag = facts.package_tag();
    let upstream = net::latest_npm_version_with_mode(ctx, PACKAGE_NAME, tag, &net::npm_registry(), mode);
    let config = store::load_config(&ctx.quantex_dir());
    match managed_registry(facts.install_source, &config) {
        Some((registry, _)) => Target {
            latest_version: net::latest_npm_version_with_mode(ctx, PACKAGE_NAME, tag, &registry, mode),
            upstream_latest_version: upstream,
            managed_registry: Some(registry),
            ..Target::default()
        },
        None => Target {
            latest_version: upstream.clone(),
            upstream_latest_version: upstream,
            ..Target::default()
        },
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlanStatus {
    ManualRequired,
    UpToDate,
    UpdateAvailable,
    CheckUnavailable,
}

/// What a check found about the newest available Quantex.
#[derive(Debug, Clone)]
pub struct Inspection {
    pub facts: Facts,
    pub latest_version: Option<String>,
    pub target: Target,
    pub status: PlanStatus,
}

impl Inspection {
    pub fn recommended_upgrade_command(&self) -> Option<&'static str> {
        self.facts.can_auto_update().then_some("quantex upgrade")
    }

    fn new(facts: Facts, target: Target) -> Self {
        let newer = target
            .latest_version
            .as_deref()
            .is_some_and(|latest| probe::is_version_newer(latest, facts.current_version));
        let status = if !facts.can_auto_update() {
            PlanStatus::ManualRequired
        } else if target.latest_version.is_some() && !newer {
            PlanStatus::UpToDate
        } else if target.latest_version.is_some() {
            PlanStatus::UpdateAvailable
        } else {
            PlanStatus::CheckUnavailable
        };
        Self {
            latest_version: target.latest_version.clone(),
            facts,
            target,
            status,
        }
    }
}

/// Looks up the newest version for this install's source and channel, read-only.
pub fn inspect(ctx: &Context, requested_channel: Option<&str>) -> Inspection {
    let facts = facts(ctx, requested_channel);
    let target = resolve_target(ctx, &facts, ctx.cache_mode);
    Inspection::new(facts, target)
}

/// v1 `planSelfUpgrade` for `upgrade`: always a fresh lookup, the install source
/// recorded, and the result cached for the update notice.
pub fn plan(ctx: &Context, requested_channel: Option<&str>) -> Inspection {
    let facts = reconciled_facts(ctx, requested_channel);
    let mode = if ctx.cache_mode == CacheMode::NoCache {
        CacheMode::NoCache
    } else {
        CacheMode::Refresh
    };
    let target = resolve_target(ctx, &facts, mode);
    if facts.can_auto_update()
        && let Some(version) = &target.latest_version
        && ctx.cache_mode != CacheMode::NoCache
    {
        let ttl_ms = store::load_config(&ctx.quantex_dir()).version_cache_ttl_hours() as i64 * 3_600_000;
        let now = crate::time::now_millis();
        net::cache_write(
            ctx,
            &metadata_key(&facts),
            &json!({
                "canAutoUpdate": true,
                "expiresAtMs": now + ttl_ms,
                "fetchedAtMs": now,
                "installSource": facts.install_source.as_str(),
                "schemaVersion": METADATA_SCHEMA_VERSION,
                "targetVersion": version,
                "updateChannel": facts.update_channel,
            }),
            now + ttl_ms,
        );
    }
    Inspection::new(facts, target)
}

fn metadata_key(facts: &Facts) -> String {
    format!(
        "self:update-metadata:{}:{}",
        facts.install_source.as_str(),
        facts.update_channel
    )
}

/// The newer version the last `upgrade` check cached, if it is still fresh. It never
/// touches the network, so any command can afford it.
pub fn cached_newer_version(ctx: &Context) -> Option<(String, &'static str)> {
    let facts = facts(ctx, None);
    if !facts.can_auto_update() || ctx.cache_mode == CacheMode::NoCache {
        return None;
    }
    let metadata = net::cache_read(ctx, &metadata_key(&facts))?;
    let now = crate::time::now_millis();
    let fetched = metadata["fetchedAtMs"].as_i64().filter(|value| *value >= 0)?;
    let expires = metadata["expiresAtMs"].as_i64().filter(|value| *value >= 0)?;
    let version = metadata["targetVersion"].as_str()?;
    let valid = metadata["schemaVersion"] == METADATA_SCHEMA_VERSION
        && metadata["canAutoUpdate"] == true
        && metadata["installSource"] == facts.install_source.as_str()
        && metadata["updateChannel"] == facts.update_channel
        && probe::compare_versions(version, version).is_some()
        && fetched <= now
        && expires > now
        && fetched < expires;
    (valid && probe::is_version_newer(version, facts.current_version))
        .then(|| (version.to_owned(), facts.current_version))
}

// ---------------------------------------------------------------------------
// Upgrade

/// Why an upgrade did not complete; `kind` is reported as `error.details.kind`.
#[derive(Debug, Clone)]
pub struct UpgradeError {
    pub kind: &'static str,
    pub message: String,
    /// The archive a failed binary upgrade tried, for the recovery hint.
    pub download_url: Option<String>,
}

impl UpgradeError {
    fn new(kind: &'static str, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            download_url: None,
        }
    }
}

/// v1 `getSelfUpgradeRecoveryHintForInspection`.
pub fn recovery_hint(inspection: &Inspection, error: Option<&UpgradeError>) -> Option<String> {
    if error.is_some_and(|error| error.kind == "locked") {
        return Some("another qtx upgrade is already running; wait for it to finish and retry".into());
    }
    let tag = inspection.facts.package_tag();
    match inspection.facts.install_source {
        InstallSource::Bun => Some(format!("bun add -g {PACKAGE_NAME}@{tag}")),
        InstallSource::Npm => Some(format!("npm install -g {PACKAGE_NAME}@{tag}")),
        InstallSource::Binary => {
            let url = error
                .and_then(|error| error.download_url.clone())
                .unwrap_or_else(|| format!("{REPOSITORY_URL}/releases/latest/download/{}", release_asset_name()));
            Some(match error.map(|error| error.kind) {
                Some("permission") => format!(
                    "check write permission for the current binary path, or download and replace the binary from {url}"
                ),
                Some("network") => {
                    format!("check network access and retry, or download and replace the binary from {url}")
                }
                _ => format!("download and replace the binary from {url}"),
            })
        }
        InstallSource::Source | InstallSource::Unknown => None,
    }
}

/// Upgrades this install to `inspection`'s target under the self-upgrade lock.
/// `Err(None)` means the deadline or a signal cut it short.
pub fn upgrade(ctx: &Context, inspection: &Inspection) -> Result<(), Option<UpgradeError>> {
    let _lock = store::acquire_lock(&ctx.quantex_dir(), LOCK_RESOURCE, &["self-upgrade"])
        .map_err(|_| Some(UpgradeError::new("locked", "Another qtx upgrade is already running.")))?;
    let facts = &inspection.facts;
    match facts.install_source {
        InstallSource::Binary => upgrade_binary(ctx, inspection),
        InstallSource::Npm | InstallSource::Bun => {
            upgrade_managed(ctx, inspection)?;
            verify_managed(ctx, inspection)
        }
        source => Err(Some(UpgradeError::new(
            "unsupported",
            format!("Install source \"{}\" does not support auto-update.", source.as_str()),
        ))),
    }
}

fn interrupted(ctx: &Context) -> bool {
    ctx.is_cancelled() || ctx.deadline_hit()
}

fn mutation_error(ctx: &Context, error: providers::MutationFailure, message: String) -> Option<UpgradeError> {
    match error {
        providers::MutationFailure::Failed(_) if !interrupted(ctx) => Some(UpgradeError::new("unknown", message)),
        _ => None,
    }
}

fn upgrade_managed(ctx: &Context, inspection: &Inspection) -> Result<(), Option<UpgradeError>> {
    let tag = inspection.facts.package_tag();
    let package = format!("{PACKAGE_NAME}@{tag}");
    let registry = inspection.target.managed_registry.as_deref();
    if inspection.facts.install_source == InstallSource::Npm {
        let mut argv = vec!["npm".to_owned(), "install".into(), "-g".into(), package];
        if let Some(registry) = registry {
            argv.extend(["--registry".to_owned(), registry.to_owned()]);
        }
        return providers::run_mutation(ctx, &argv, "npm install failed")
            .map_err(|error| mutation_error(ctx, error, format!("Failed to update {PACKAGE_NAME} through npm.")));
    }
    let mut argv = vec!["bun".to_owned(), "add".into(), "-g".into()];
    if let Some(registry) = registry {
        argv.extend(["--registry".to_owned(), registry.to_owned()]);
    }
    argv.push(package);
    let message = format!("Failed to update {PACKAGE_NAME} through Bun.");
    providers::run_mutation(ctx, &argv, "bun add failed")
        .map_err(|error| mutation_error(ctx, error, message.clone()))?;
    providers::trust_bun_packages(ctx, &[PACKAGE_NAME.to_owned()]).map_err(|error| mutation_error(ctx, error, message))
}

/// The version `<executable> --version` reports.
fn reported_version(ctx: &Context, executable: &Path) -> Result<(Option<i32>, String), Option<UpgradeError>> {
    let budget = ctx
        .remaining()
        .unwrap_or(std::time::Duration::from_secs(30))
        .min(std::time::Duration::from_secs(30));
    match process::run_captured(executable, ["--version"], Some(budget)) {
        Ok(output) => Ok((output.code, output.stdout)),
        Err(_) if interrupted(ctx) => Err(None),
        Err(_) => Err(Some(UpgradeError::new(
            "verify",
            "Failed to execute the upgraded Quantex binary for verification.",
        ))),
    }
}

/// v1 `verifySelfUpgradeResult` for npm and Bun: the reinstalled executable must
/// report the target version.
fn verify_managed(ctx: &Context, inspection: &Inspection) -> Result<(), Option<UpgradeError>> {
    let observed = match reported_version(ctx, &inspection.facts.executable_path)? {
        (Some(0), stdout) => stdout
            .lines()
            .next()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(|line| probe::find_version(line).unwrap_or_else(|| line.to_owned())),
        _ => None,
    };
    let Some(observed) = observed else {
        return Err(Some(UpgradeError::new(
            "verify",
            "Managed self-upgrade finished but Quantex could not verify the installed version afterwards.",
        )));
    };
    match &inspection.target.latest_version {
        Some(expected) if &observed != expected => Err(Some(UpgradeError::new(
            "verify",
            format!("Managed self-upgrade installed version {observed}, but expected {expected}."),
        ))),
        _ => Ok(()),
    }
}

fn binary_failure(kind: &'static str, message: impl Into<String>, url: &str) -> Option<UpgradeError> {
    Some(UpgradeError {
        kind,
        message: message.into(),
        download_url: Some(url.to_owned()),
    })
}

fn io_kind(error: &std::io::Error) -> &'static str {
    match error.kind() {
        std::io::ErrorKind::PermissionDenied => "permission",
        std::io::ErrorKind::ResourceBusy => "locked",
        _ => "unknown",
    }
}

/// v1 `upgradeStandaloneBinary`: download, check the SHA-256, unpack, swap the
/// executable keeping a `.bak` until the new one reports the target version.
fn upgrade_binary(ctx: &Context, inspection: &Inspection) -> Result<(), Option<UpgradeError>> {
    let Some(asset) = &inspection.target.asset else {
        return Err(Some(inspection.target.resolution_error.clone().unwrap_or_else(|| {
            UpgradeError::new(
                "unsupported",
                "No release artifact is available for the current platform and architecture.",
            )
        })));
    };
    let url = asset["downloadUrl"].as_str().unwrap_or_default();
    let name = asset["name"].as_str().unwrap_or_default();
    let Some(entry) = archive::binary_name(name) else {
        return Err(binary_failure(
            "unsupported",
            "The resolved release artifact is not a compressed standalone binary archive.",
            url,
        ));
    };
    let downloaded = match net::download(ctx, url) {
        Ok(bytes) => bytes,
        Err(net::DownloadError::TimedOut) => return Err(None),
        Err(net::DownloadError::Status(status)) => {
            return Err(binary_failure(
                "network",
                format!("Failed to download {url}: HTTP {status}."),
                url,
            ));
        }
        Err(net::DownloadError::Failed(_)) if interrupted(ctx) => return Err(None),
        Err(net::DownloadError::Failed(_)) => {
            return Err(binary_failure("network", format!("Failed to download {url}."), url));
        }
    };
    if interrupted(ctx) {
        return Err(None);
    }
    let expected = asset["checksum"].as_str().unwrap_or_default().trim().to_lowercase();
    let actual: String = Sha256::digest(&downloaded)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    if actual != expected {
        return Err(binary_failure(
            "checksum",
            format!("Checksum mismatch for {url}. Expected {expected}, got {actual}."),
            url,
        ));
    }
    let binary = archive::extract(&downloaded, entry).map_err(|_| {
        binary_failure(
            "unknown",
            format!("Failed to extract the expected binary from {url}."),
            url,
        )
    })?;
    let version = inspection.target.latest_version.clone();
    let swap_failed =
        |error: std::io::Error| binary_failure(io_kind(&error), "Failed to replace the current Quantex binary.", url);
    let executable = inspection.facts.executable_path.clone();
    let directory = executable.parent().map(Path::to_path_buf).unwrap_or_default();
    let temp_dir = directory.join(format!(".quantex-upgrade-{}", uuid::Uuid::new_v4().simple()));
    fs::create_dir(&temp_dir).map_err(swap_failed)?;
    let temp_path = temp_dir.join(executable.file_name().unwrap_or_default());
    let result = swap(
        ctx,
        &executable,
        &temp_dir,
        &temp_path,
        &binary,
        version.as_deref(),
        url,
    );
    if !matches!(result, Ok(Swap::Scheduled)) {
        let _ = fs::remove_dir_all(&temp_dir);
    }
    result.map(|_| ())
}

enum Swap {
    Done,
    /// Windows: a helper replaces the executable once this process exits.
    Scheduled,
}

fn swap(
    ctx: &Context,
    executable: &Path,
    temp_dir: &Path,
    temp_path: &Path,
    binary: &[u8],
    version: Option<&str>,
    url: &str,
) -> Result<Swap, Option<UpgradeError>> {
    let swap_failed =
        |error: std::io::Error| binary_failure(io_kind(&error), "Failed to replace the current Quantex binary.", url);
    fs::write(temp_path, binary).map_err(swap_failed)?;
    if interrupted(ctx) {
        return Err(None);
    }
    let backup = PathBuf::from(format!("{}.bak", executable.display()));
    if cfg!(windows) {
        return schedule_windows_replacement(temp_path, executable, &backup, temp_dir, version)
            .map(|()| Swap::Scheduled)
            .map_err(|_| binary_failure("locked", "Failed to schedule Windows binary replacement.", url));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = fs::metadata(executable)
            .map(|metadata| metadata.permissions().mode() & 0o777)
            .unwrap_or(0o755);
        fs::set_permissions(temp_path, fs::Permissions::from_mode(mode)).map_err(swap_failed)?;
    }
    if interrupted(ctx) {
        return Err(None);
    }
    let _ = fs::remove_file(&backup);
    fs::rename(executable, &backup).map_err(swap_failed)?;
    if let Err(error) = fs::rename(temp_path, executable) {
        let _ = restore(&backup, executable);
        return Err(swap_failed(error));
    }
    if let Err(error) = verify_binary(ctx, executable, version, url) {
        let _ = restore(&backup, executable);
        return Err(error);
    }
    // The new binary is live; a stale backup is not a failed swap.
    let _ = fs::remove_file(&backup);
    Ok(Swap::Done)
}

fn restore(backup: &Path, executable: &Path) -> std::io::Result<()> {
    let _ = fs::remove_file(executable);
    fs::rename(backup, executable)
}

fn verify_binary(
    ctx: &Context,
    executable: &Path,
    version: Option<&str>,
    url: &str,
) -> Result<(), Option<UpgradeError>> {
    let Some(version) = version else {
        return Ok(());
    };
    let (code, stdout) = reported_version(ctx, executable).map_err(|error| {
        error.map(|mut error| {
            error.download_url = Some(url.to_owned());
            error
        })
    })?;
    if code != Some(0) {
        return Err(binary_failure(
            "verify",
            format!(
                "The upgraded Quantex binary exited with code {} during verification.",
                code.unwrap_or(-1)
            ),
            url,
        ));
    }
    if !stdout.contains(version) {
        return Err(binary_failure(
            "verify",
            "The upgraded Quantex binary reported an unexpected version during verification.",
            url,
        ));
    }
    Ok(())
}

/// The other name of a Windows standalone install (`qtx.exe` beside `quantex.exe`).
fn windows_peer(executable: &Path) -> Option<PathBuf> {
    let name = executable.file_name()?.to_string_lossy().to_lowercase();
    let peer = match name.as_str() {
        "qtx.exe" => "quantex.exe",
        "quantex.exe" => "qtx.exe",
        _ => return None,
    };
    Some(executable.with_file_name(peer))
}

fn powershell_literal(path: &Path) -> String {
    path.to_string_lossy().replace('\'', "''")
}

/// v1's delayed replacement: a hidden PowerShell waits for this process to exit, swaps
/// the executable, checks `--version`, and rolls back on failure.
fn schedule_windows_replacement(
    temp_path: &Path,
    executable: &Path,
    backup: &Path,
    temp_dir: &Path,
    version: Option<&str>,
) -> std::io::Result<()> {
    let peer = windows_peer(executable)
        .map(|peer| powershell_literal(&peer))
        .unwrap_or_default();
    let script = [
        "$ErrorActionPreference = 'Stop'".to_owned(),
        format!("$pidToWait = {}", std::process::id()),
        format!("$tempPath = '{}'", powershell_literal(temp_path)),
        format!("$targetPath = '{}'", powershell_literal(executable)),
        format!("$backupPath = '{}'", powershell_literal(backup)),
        format!("$tempDir = '{}'", powershell_literal(temp_dir)),
        format!("$expectedVersion = '{}'", version.unwrap_or_default().replace('\'', "''")),
        format!("$peerPath = '{peer}'"),
        "while (Get-Process -Id $pidToWait -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 200 }".into(),
        "$backupReady = $false".into(),
        "for ($attempt = 0; $attempt -lt 50; $attempt++) {".into(),
        "  try {".into(),
        "    if (Test-Path -LiteralPath $backupPath) { Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue }".into(),
        "    Move-Item -LiteralPath $targetPath -Destination $backupPath -Force -ErrorAction Stop".into(),
        "    $backupReady = $true".into(),
        "    break".into(),
        "  }".into(),
        "  catch {".into(),
        "    Start-Sleep -Milliseconds 200".into(),
        "  }".into(),
        "}".into(),
        "if (-not $backupReady) {".into(),
        "  Remove-Item -LiteralPath $tempDir -Force -Recurse -ErrorAction SilentlyContinue".into(),
        "  exit 1".into(),
        "}".into(),
        "try {".into(),
        "  Move-Item -LiteralPath $tempPath -Destination $targetPath -Force".into(),
        "}".into(),
        "catch {".into(),
        "  if (Test-Path -LiteralPath $backupPath) {".into(),
        "    Move-Item -LiteralPath $backupPath -Destination $targetPath -Force -ErrorAction SilentlyContinue".into(),
        "  }".into(),
        "  Remove-Item -LiteralPath $tempDir -Force -Recurse -ErrorAction SilentlyContinue".into(),
        "  exit 1".into(),
        "}".into(),
        "if ($expectedVersion -ne '') {".into(),
        "  $output = & $targetPath --version 2>$null".into(),
        "  if ($LASTEXITCODE -ne 0 -or ($output -notmatch [regex]::Escape($expectedVersion))) {".into(),
        "    Remove-Item -LiteralPath $targetPath -Force -ErrorAction SilentlyContinue".into(),
        "    Move-Item -LiteralPath $backupPath -Destination $targetPath -Force".into(),
        "    Remove-Item -LiteralPath $tempDir -Force -Recurse -ErrorAction SilentlyContinue".into(),
        "    exit 1".into(),
        "  }".into(),
        "}".into(),
        "if ($peerPath -ne '') {".into(),
        "  Copy-Item -LiteralPath $targetPath -Destination $peerPath -Force".into(),
        "}".into(),
        "Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue".into(),
        "Remove-Item -LiteralPath $tempDir -Force -Recurse -ErrorAction SilentlyContinue".into(),
    ]
    .join("; ");
    let mut command = std::process::Command::new("powershell.exe");
    command
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &script,
        ])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(DETACHED_PROCESS | CREATE_NO_WINDOW);
    }
    command.spawn().map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_sources_are_detected_from_the_executable_path() {
        let detect = |path: &str| detect_install_source(Path::new(path));
        assert_eq!(
            detect("/Users/a/.bun/install/global/node_modules/quantex-cli-darwin-arm64/bin/quantex"),
            InstallSource::Bun
        );
        assert_eq!(
            detect("/usr/local/lib/node_modules/quantex-cli-linux-x64/bin/quantex"),
            InstallSource::Npm
        );
        assert_eq!(
            detect(r"C:\Users\a\AppData\Roaming\npm\node_modules\quantex-cli-win32-x64\bin\quantex.exe"),
            InstallSource::Npm
        );
        assert_eq!(detect("/repo/target/debug/quantex"), InstallSource::Source);
        assert_eq!(detect("/Users/a/.local/bin/quantex"), InstallSource::Binary);
    }

    #[test]
    fn npmrc_uses_the_last_registry_line() {
        let text = "registry=https://a.example/\n# registry=https://ignored/\nregistry = https://b.example\n";
        assert_eq!(npmrc_registry(text).as_deref(), Some("https://b.example"));
    }

    #[test]
    fn bunfig_registry_forms() {
        assert_eq!(
            bunfig_registry("install.registry = \"https://a.example\"").as_deref(),
            Some("https://a.example")
        );
        assert_eq!(
            bunfig_registry("[install]\nregistry = { url = \"https://b.example\" }\n[other]\n").as_deref(),
            Some("https://b.example")
        );
        assert_eq!(
            bunfig_registry("install = { registry = \"https://c.example\" }").as_deref(),
            Some("https://c.example")
        );
        assert_eq!(bunfig_registry("[run]\nregistry = \"x\""), None);
    }
}
