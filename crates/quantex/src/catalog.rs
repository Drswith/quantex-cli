//! The supported-agent catalog, embedded from `contract/catalog/`.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use serde::Deserialize;
use serde_json::{Map, Value, json};

include!(concat!(env!("OUT_DIR"), "/catalog_files.rs"));

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Platform {
    Windows,
    Macos,
    Linux,
}

impl Platform {
    pub fn current() -> Self {
        if cfg!(windows) {
            Self::Windows
        } else if cfg!(target_os = "macos") {
            Self::Macos
        } else {
            Self::Linux
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Windows => "windows",
            Self::Macos => "macos",
            Self::Linux => "linux",
        }
    }
}

/// Every way an agent can be installed; `script` and `binary` run a command.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Bun,
    Npm,
    Brew,
    Cargo,
    Deno,
    Mise,
    Pip,
    Uv,
    Winget,
    Script,
    Binary,
}

impl Provider {
    pub const MANAGED: [Provider; 9] = [
        Provider::Bun,
        Provider::Npm,
        Provider::Brew,
        Provider::Cargo,
        Provider::Deno,
        Provider::Mise,
        Provider::Pip,
        Provider::Uv,
        Provider::Winget,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Bun => "bun",
            Self::Npm => "npm",
            Self::Brew => "brew",
            Self::Cargo => "cargo",
            Self::Deno => "deno",
            Self::Mise => "mise",
            Self::Pip => "pip",
            Self::Uv => "uv",
            Self::Winget => "winget",
            Self::Script => "script",
            Self::Binary => "binary",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        serde_json::from_value(Value::String(text.to_owned())).ok()
    }

    pub fn is_managed(self) -> bool {
        !matches!(self, Self::Script | Self::Binary)
    }

    /// The `packages` metadata key a provider's target identifier lives under.
    pub fn package_key(self) -> Option<&'static str> {
        match self {
            Self::Bun | Self::Npm => Some("npm"),
            Self::Cargo => Some("cargo"),
            Self::Deno => Some("deno"),
            Self::Mise => Some("mise"),
            Self::Pip => Some("pip"),
            Self::Uv => Some("uv"),
            Self::Brew | Self::Winget | Self::Script | Self::Binary => None,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Effect {
    Executable { command: Vec<String> },
    ShellScript { command: String },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetSource {
    pub id: String,
    pub kind: String,
    #[serde(default)]
    pub arguments: Vec<String>,
    pub binary_name: Option<String>,
    pub effect: Option<Effect>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyFlags {
    #[serde(default)]
    pub package_name_in_method: bool,
}

/// One install candidate for a platform.
#[derive(Debug, Clone, Deserialize)]
pub struct Candidate {
    pub provider: Provider,
    pub target: TargetSource,
    #[serde(default)]
    pub probes: Vec<String>,
    #[serde(default)]
    pub legacy: Option<LegacyFlags>,
}

impl Candidate {
    /// The command a script or binary candidate runs, rendered as one string.
    pub fn command(&self) -> Option<String> {
        match self.target.effect.as_ref()? {
            Effect::ShellScript { command } => Some(command.clone()),
            Effect::Executable { command } => Some(
                command
                    .iter()
                    .map(|part| {
                        if part.contains(' ') {
                            serde_json::to_string(part).unwrap()
                        } else {
                            part.clone()
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(" "),
            ),
        }
    }

    /// The v1 `InstallMethod` projection of this candidate.
    pub fn install_method(&self) -> InstallMethod {
        if !self.provider.is_managed() {
            return InstallMethod {
                kind: self.provider,
                binary_name: self.target.binary_name.clone(),
                command: self.command(),
                package_install_args: Vec::new(),
                package_name: None,
                package_target_kind: None,
            };
        }
        let in_method = self.legacy.as_ref().is_some_and(|legacy| legacy.package_name_in_method);
        InstallMethod {
            kind: self.provider,
            binary_name: self.target.binary_name.clone(),
            command: None,
            package_install_args: self.target.arguments.clone(),
            package_name: (self.provider.package_key().is_none() || in_method).then(|| self.target.id.clone()),
            package_target_kind: matches!(self.target.kind.as_str(), "cask" | "id").then(|| self.target.kind.clone()),
        }
    }
}

/// The v1 install-method shape that state records and several outputs use.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallMethod {
    pub kind: Provider,
    pub binary_name: Option<String>,
    pub command: Option<String>,
    pub package_install_args: Vec<String>,
    pub package_name: Option<String>,
    pub package_target_kind: Option<String>,
}

impl InstallMethod {
    pub fn to_value(&self) -> Value {
        let mut map = Map::new();
        if let Some(binary_name) = &self.binary_name {
            map.insert("binaryName".into(), binary_name.clone().into());
        }
        if let Some(command) = &self.command {
            map.insert("command".into(), command.clone().into());
        }
        if !self.package_install_args.is_empty() {
            map.insert("packageInstallArgs".into(), json!(self.package_install_args));
        }
        if let Some(package_name) = &self.package_name {
            map.insert("packageName".into(), package_name.clone().into());
        }
        if let Some(kind) = &self.package_target_kind {
            map.insert("packageTargetKind".into(), kind.clone().into());
        }
        map.insert("type".into(), self.kind.as_str().into());
        Value::Object(map)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelfUpdate {
    pub command: Vec<String>,
    #[serde(default)]
    pub fallback_commands: Vec<Vec<String>>,
    pub version_after: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct VersionProbe {
    pub command: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentSource {
    name: String,
    display_name: String,
    homepage: String,
    binary_name: String,
    #[serde(default)]
    lookup_aliases: Vec<String>,
    #[serde(default)]
    packages: BTreeMap<String, String>,
    #[serde(default)]
    superseded_packages: BTreeMap<String, Vec<String>>,
    platforms: BTreeMap<String, Vec<Candidate>>,
    self_update: Option<SelfUpdate>,
    version_probe: Option<VersionProbe>,
}

#[derive(Debug, Clone)]
pub struct Agent {
    pub name: String,
    pub display_name: String,
    pub homepage: String,
    pub binary_name: String,
    pub lookup_aliases: Vec<String>,
    /// Package identifiers by metadata key (`npm`, `cargo`, ...), including the ones
    /// implied by provider targets.
    pub packages: BTreeMap<String, String>,
    pub superseded_packages: BTreeMap<String, Vec<String>>,
    pub platforms: BTreeMap<Platform, Vec<Candidate>>,
    pub self_update: Option<SelfUpdate>,
    pub version_probe: Option<VersionProbe>,
}

impl Agent {
    fn from_source(source: AgentSource) -> Self {
        let mut packages = source.packages.clone();
        let mut platforms = BTreeMap::new();
        for (platform, candidates) in source.platforms {
            let platform = match platform.as_str() {
                "windows" => Platform::Windows,
                "macos" => Platform::Macos,
                "linux" => Platform::Linux,
                other => panic!("{}: unknown platform {other}", source.name),
            };
            for candidate in &candidates {
                if let Some(key) = candidate.provider.package_key() {
                    let existing = packages
                        .entry(key.to_owned())
                        .or_insert_with(|| candidate.target.id.clone());
                    assert_eq!(
                        existing, &candidate.target.id,
                        "{} binds conflicting {key} package targets",
                        source.name
                    );
                }
            }
            platforms.insert(platform, candidates);
        }
        Self {
            name: source.name,
            display_name: source.display_name,
            homepage: source.homepage,
            binary_name: source.binary_name,
            lookup_aliases: source.lookup_aliases,
            packages,
            superseded_packages: source.superseded_packages,
            platforms,
            self_update: source.self_update,
            version_probe: source.version_probe,
        }
    }

    /// Install candidates for the current platform, in catalog preference order.
    pub fn candidates(&self) -> &[Candidate] {
        self.candidates_for(Platform::current())
    }

    pub fn candidates_for(&self, platform: Platform) -> &[Candidate] {
        self.platforms.get(&platform).map_or(&[], Vec::as_slice)
    }

    /// v1 install methods for the current platform.
    pub fn install_methods(&self) -> Vec<InstallMethod> {
        self.candidates().iter().map(Candidate::install_method).collect()
    }

    pub fn package_for(&self, provider: Provider) -> Option<&str> {
        provider
            .package_key()
            .and_then(|key| self.packages.get(key))
            .map(String::as_str)
    }

    pub fn is_superseded_package(&self, provider: Provider, package: &str) -> bool {
        provider
            .package_key()
            .and_then(|key| self.superseded_packages.get(key))
            .is_some_and(|list| list.iter().any(|item| item == package))
    }
}

pub fn agents() -> &'static [Agent] {
    static AGENTS: OnceLock<Vec<Agent>> = OnceLock::new();
    AGENTS.get_or_init(|| {
        let mut agents: Vec<Agent> = CATALOG_FILES
            .iter()
            .map(|text| {
                let source: AgentSource = serde_json::from_str(text).expect("catalog entry is valid");
                Agent::from_source(source)
            })
            .collect();
        agents.sort_by(|a, b| a.name.cmp(&b.name));
        agents
    })
}

/// Looks an agent up by name, lookup alias, or case-insensitive display name.
pub fn find(name: &str) -> Option<&'static Agent> {
    let all = agents();
    all.iter()
        .find(|agent| agent.name == name || agent.lookup_aliases.iter().any(|alias| alias == name))
        .or_else(|| {
            let wanted = name.trim().to_lowercase();
            all.iter()
                .find(|agent| agent.display_name.trim().to_lowercase() == wanted)
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_loads_every_agent() {
        assert_eq!(agents().len(), 33);
        assert!(find("claude").is_some());
        assert!(find("Claude Code").is_some());
        assert!(find("not-an-agent").is_none());
    }

    #[test]
    fn script_candidates_render_commands() {
        let claude = find("claude").unwrap();
        let script = claude
            .candidates_for(Platform::Macos)
            .iter()
            .find(|candidate| candidate.provider == Provider::Script)
            .unwrap();
        assert!(script.command().unwrap().contains("claude.ai/install.sh"));
    }

    #[test]
    fn npm_packages_are_projected_into_metadata() {
        let claude = find("claude").unwrap();
        assert_eq!(claude.package_for(Provider::Npm), Some("@anthropic-ai/claude-code"));
        assert_eq!(claude.package_for(Provider::Bun), Some("@anthropic-ai/claude-code"));
    }
}
