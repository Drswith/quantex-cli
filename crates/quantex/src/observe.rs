//! What Quantex can see about an agent: recorded install, executable, versions.

use std::path::PathBuf;

use serde_json::{Value, json};

use crate::catalog::{self, Agent, InstallMethod, Provider};
use crate::context::Context;
use crate::net;
use crate::probe;
use crate::protocol::Warning;
use crate::store::{self, InstalledAgent, State};

/// How an agent's updates are handled.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpdateStrategy {
    Managed,
    SelfUpdate,
    ManualHint,
}

/// An agent as observed on this machine.
#[derive(Debug, Clone)]
pub struct Observation {
    pub agent: &'static Agent,
    pub methods: Vec<InstallMethod>,
    pub installed: Option<InstalledAgent>,
    pub present: bool,
    /// The resolved executable, with symlinks followed.
    pub path: Option<PathBuf>,
    pub version: Option<String>,
    pub latest_version: Option<String>,
}

/// Install methods for the current platform with the configured default package
/// manager first.
pub fn ordered_methods(ctx: &Context, agent: &Agent) -> Vec<InstallMethod> {
    let preferred = store::load_config(&ctx.quantex_dir())
        .default_package_manager()
        .to_owned();
    let methods = agent.install_methods();
    let (first, rest): (Vec<_>, Vec<_>) = methods
        .into_iter()
        .partition(|method| method.kind.as_str() == preferred);
    first.into_iter().chain(rest).collect()
}

/// The recorded install's package if the catalog lists it as superseded.
pub fn superseded_package(agent: &Agent, installed: Option<&InstalledAgent>) -> Option<(String, Option<String>)> {
    let installed = installed?;
    let recorded = installed.package_name.as_deref()?;
    if !agent.is_superseded_package(installed.install_type, recorded) {
        return None;
    }
    let current = agent.package_for(installed.install_type).map(str::to_owned);
    Some((recorded.to_owned(), current))
}

pub fn superseded_warning(agent: &Agent, installed: Option<&InstalledAgent>) -> Option<Warning> {
    let (recorded, current) = superseded_package(agent, installed)?;
    let replacement = match &current {
        Some(package) => format!("which upstream replaced with {package}"),
        None => "which upstream no longer publishes".to_owned(),
    };
    let message = format!(
        "{} is installed from {recorded}, {replacement}. Quantex cannot compare versions across the rename. Run `quantex uninstall {}` then `quantex install {}` to move onto the current package.",
        agent.display_name, agent.name, agent.name
    );
    let mut details = serde_json::Map::new();
    details.insert("agentName".into(), agent.name.clone().into());
    if let Some(current) = &current {
        details.insert("currentPackage".into(), current.clone().into());
    }
    details.insert("recordedPackage".into(), recorded.into());
    details.insert("suggestedAction".into(), "reinstall-agent".into());
    details.insert(
        "suggestedCommands".into(),
        json!([
            format!("quantex uninstall {}", agent.name),
            format!("quantex install {}", agent.name)
        ]),
    );
    Some(Warning::new("AGENT_PACKAGE_SUPERSEDED", message).details(Value::Object(details)))
}

/// The npm package whose `latest` dist-tag answers "what is the newest version".
pub fn latest_version_package(
    agent: &Agent,
    installed: Option<&InstalledAgent>,
    methods: &[InstallMethod],
) -> Option<String> {
    if let Some(installed) = installed {
        if !installed.install_type.can_lookup_latest() || superseded_package(agent, Some(installed)).is_some() {
            return None;
        }
        return installed
            .package_name
            .clone()
            .filter(|name| !name.is_empty())
            .or_else(|| agent.package_for(Provider::Npm).map(str::to_owned));
    }
    let npm = agent.package_for(Provider::Npm)?;
    (!methods.is_empty() && methods.iter().all(|method| method.kind.can_lookup_latest())).then(|| npm.to_owned())
}

pub fn update_strategy(agent: &Agent, installed: Option<&InstalledAgent>, methods: &[InstallMethod]) -> UpdateStrategy {
    let managed = match installed {
        Some(installed) => installed.install_type.is_managed(),
        None => methods
            .iter()
            .any(|method| method.kind.is_managed() && method.kind.can_update()),
    };
    if managed {
        return UpdateStrategy::Managed;
    }
    let can_update_recorded = installed.is_some_and(|installed| installed.install_type.can_update());
    if !can_update_recorded && agent.self_update.is_some() {
        return UpdateStrategy::SelfUpdate;
    }
    UpdateStrategy::ManualHint
}

fn package_target(name: Option<&str>, kind: Option<&str>) -> String {
    match (name, kind) {
        (None, _) => String::new(),
        (Some(name), Some("cask")) => format!(" ({name} cask)"),
        (Some(name), Some("id")) => format!(" ({name} id)"),
        (Some(name), _) => format!(" ({name})"),
    }
}

/// `managed via npm (@openai/codex)`, `script installer`, `detected on disk`, ...
pub fn source_label(installed: Option<&InstalledAgent>) -> String {
    let Some(installed) = installed else {
        return "detected on disk".into();
    };
    if installed.install_type.is_managed() {
        return format!(
            "managed via {}{}",
            installed.install_type.as_str(),
            package_target(
                installed.package_name.as_deref(),
                installed.package_target_kind.as_deref()
            )
        );
    }
    if installed.install_type == Provider::Script {
        "script installer".into()
    } else {
        "binary installer".into()
    }
}

/// `managed/npm`, `managed/brew (claude-code cask)`, `unmanaged/script`, ...
pub fn method_label(method: &InstallMethod) -> String {
    if method.kind.is_managed() {
        return format!(
            "{}/{}{}",
            method.kind.lifecycle(),
            method.kind.as_str(),
            package_target(method.package_name.as_deref(), method.package_target_kind.as_deref())
        );
    }
    if method.kind == Provider::Script {
        "unmanaged/script".into()
    } else {
        "unmanaged/binary".into()
    }
}

/// The package a managed method installs: its own name, else the agent metadata.
pub fn method_package(agent: &Agent, method: &InstallMethod) -> Option<String> {
    method
        .package_name
        .clone()
        .or_else(|| agent.package_for(method.kind).map(str::to_owned))
}

/// The shell command a method corresponds to, for display.
pub fn method_command(agent: &Agent, method: &InstallMethod) -> String {
    let package = method_package(agent, method);
    match method.kind {
        Provider::Bun => package.map(|p| format!("bun add -g {p}")).unwrap_or_default(),
        Provider::Npm => package.map(|p| format!("npm i -g {p}")).unwrap_or_default(),
        Provider::Brew => match &method.package_name {
            Some(name) if method.package_target_kind.as_deref() == Some("cask") => {
                format!("brew install --cask {name}")
            }
            Some(name) => format!("brew install {name}"),
            None => String::new(),
        },
        Provider::Winget => method
            .package_name
            .as_ref()
            .map(|name| format!("winget install --id {name} -e"))
            .unwrap_or_default(),
        Provider::Script | Provider::Binary => method.command.clone().unwrap_or_default(),
    }
}

/// `{ command, label, type }` rows used by `info`, `inspect`, and `resolve`.
pub fn method_rows(agent: &Agent, methods: &[InstallMethod]) -> Vec<Value> {
    methods
        .iter()
        .map(|method| {
            json!({
                "command": method_command(agent, method),
                "label": method_label(method),
                "type": method.kind.as_str(),
            })
        })
        .collect()
}

impl Observation {
    pub fn lifecycle(&self) -> &'static str {
        self.installed
            .as_ref()
            .map_or("unmanaged", |installed| installed.install_type.lifecycle())
    }

    pub fn source_label(&self) -> String {
        source_label(self.installed.as_ref())
    }

    /// `managed update`, `command update`, or `manual update`. v1 computes this without
    /// catalog methods, so an untracked agent is never `managed update`.
    pub fn update_label(&self) -> &'static str {
        match update_strategy(self.agent, self.installed.as_ref(), &[]) {
            UpdateStrategy::Managed => "managed update",
            UpdateStrategy::SelfUpdate => "command update",
            UpdateStrategy::ManualHint => "manual update",
        }
    }

    pub fn path_string(&self) -> Option<String> {
        self.path.as_ref().map(|path| path.to_string_lossy().into_owned())
    }

    pub fn self_update_commands(&self) -> Vec<String> {
        self.agent
            .self_update
            .as_ref()
            .map(|update| {
                std::iter::once(&update.command)
                    .chain(update.fallback_commands.iter())
                    .map(|command| command.join(" "))
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn superseded_warning(&self) -> Option<Warning> {
        superseded_warning(self.agent, self.installed.as_ref())
    }

    /// `{ aliases, binaryName, displayName, installMethods, name, packageName?, selfUpdateCommands }`.
    pub fn agent_summary(&self) -> Value {
        let mut map = serde_json::Map::new();
        map.insert("aliases".into(), json!(self.agent.lookup_aliases));
        map.insert("binaryName".into(), self.agent.binary_name.clone().into());
        map.insert("displayName".into(), self.agent.display_name.clone().into());
        map.insert(
            "installMethods".into(),
            Value::Array(method_rows(self.agent, &self.methods)),
        );
        map.insert("name".into(), self.agent.name.clone().into());
        if let Some(package) = self.agent.package_for(Provider::Npm) {
            map.insert("packageName".into(), package.into());
        }
        map.insert("selfUpdateCommands".into(), json!(self.self_update_commands()));
        Value::Object(map)
    }
}

/// Options for one observation.
#[derive(Debug, Clone, Copy)]
pub struct ObserveOptions {
    pub latest_version: bool,
}

impl Default for ObserveOptions {
    fn default() -> Self {
        Self { latest_version: true }
    }
}

pub fn observe(ctx: &Context, agent: &'static Agent, state: &State, options: ObserveOptions) -> Observation {
    let methods = ordered_methods(ctx, agent);
    let installed = state.installed_agents.get(&agent.name).cloned();
    let resolved = probe::resolve_executable(&probe::lookup_names(agent));
    let (version, latest_version) = std::thread::scope(|scope| {
        let version = scope.spawn(|| {
            resolved
                .as_deref()
                .and_then(|path| probe::probe_version(ctx, agent, Some(path)))
        });
        let latest = options
            .latest_version
            .then(|| latest_version_package(agent, installed.as_ref(), &methods))
            .flatten()
            .and_then(|package| net::latest_npm_version(ctx, &package, "latest", &net::npm_registry()));
        (version.join().unwrap_or_default(), latest)
    });
    let path = resolved.as_deref().map(probe::real_path);
    Observation {
        agent,
        methods,
        installed,
        present: path.is_some(),
        path,
        version,
        latest_version,
    }
}

/// Observes every catalog agent in parallel.
pub fn observe_all(ctx: &Context, state: &State, options: ObserveOptions) -> Vec<Observation> {
    std::thread::scope(|scope| {
        let handles: Vec<_> = catalog::agents()
            .iter()
            .map(|agent| scope.spawn(move || observe(ctx, agent, state, options)))
            .collect();
        handles.into_iter().map(|handle| handle.join().unwrap()).collect()
    })
}
