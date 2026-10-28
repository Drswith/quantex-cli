//! Facts about this Quantex install: where it came from and whether it can upgrade
//! itself.

use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::context::Context;
use crate::net;
use crate::store;

pub const PACKAGE_NAME: &str = "quantex-cli";
pub const REPOSITORY_URL: &str = "https://github.com/Drswith/quantex-cli";

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
}

/// The executable this process runs from, with symlinks followed.
pub fn executable_path() -> PathBuf {
    std::env::current_exe()
        .map(|path| crate::probe::real_path(&path))
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

/// The GitHub release asset name for this platform, e.g. `quantex-darwin-arm64.tar.gz`.
pub fn release_asset_name() -> &'static str {
    if cfg!(windows) {
        "quantex-windows-x64.exe.zip"
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "quantex-darwin-arm64.tar.gz"
        } else {
            "quantex-darwin-x64.tar.gz"
        }
    } else if cfg!(target_arch = "aarch64") {
        "quantex-linux-arm64.tar.gz"
    } else {
        "quantex-linux-x64.tar.gz"
    }
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

/// The release manifest for a channel.
pub fn fetch_manifest(ctx: &Context, channel: &str) -> Option<Value> {
    let url = if channel == "stable" {
        format!("{}/manifest.json", release_base_url())
    } else {
        let releases = net::fetch_json_with_cache(
            ctx,
            "https://api.github.com/repos/Drswith/quantex-cli/releases?per_page=20",
            "self:github-releases",
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
    net::fetch_json_with_cache(ctx, &url, &format!("self:manifest:{channel}"))
}

/// What a check found about the newest available Quantex.
#[derive(Debug, Clone)]
pub struct Inspection {
    pub facts: Facts,
    pub latest_version: Option<String>,
}

impl Inspection {
    pub fn recommended_upgrade_command(&self) -> Option<&'static str> {
        self.facts.can_auto_update().then_some("quantex upgrade")
    }
}

/// Looks up the newest version for this install's source and channel.
pub fn inspect(ctx: &Context, requested_channel: Option<&str>) -> Inspection {
    let facts = facts(ctx, requested_channel);
    let latest_version = match facts.install_source {
        InstallSource::Binary => fetch_manifest(ctx, facts.update_channel)
            .and_then(|manifest| manifest["version"].as_str().map(str::to_owned)),
        _ => {
            let tag = if facts.update_channel == "beta" {
                "beta"
            } else {
                "latest"
            };
            let registry = match facts.install_source {
                InstallSource::Bun | InstallSource::Npm => store::load_config(&ctx.quantex_dir())
                    .self_update_registry()
                    .map_or_else(net::npm_registry, str::to_owned),
                _ => net::npm_registry(),
            };
            net::latest_npm_version(ctx, PACKAGE_NAME, tag, &registry)
        }
    };
    Inspection { facts, latest_version }
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
}
