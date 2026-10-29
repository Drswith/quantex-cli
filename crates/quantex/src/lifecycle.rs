//! Install, update, and uninstall: observe, decide, execute, verify, record.
//!
//! The `installedAgents` record names an agent's source; its package manager (or `PATH`,
//! for a script install) confirms it is still there.

use std::path::PathBuf;

use crate::catalog::{Agent, InstallMethod};
use crate::context::Context;
use crate::observe::{self, ObserveOptions};
use crate::providers::{self, Binding, Observed};
use crate::store::{InstalledAgent, State};

/// Where the agent's executable is, as seen on `PATH`.
#[derive(Debug, Clone, Default)]
pub struct Executable {
    pub present: bool,
    pub path: Option<PathBuf>,
    pub version: Option<String>,
}

/// What a fresh observation found.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Status {
    /// Recorded, and its package manager (or `PATH`, for a script install) has it.
    Managed,
    /// On `PATH` with no record that accounts for it.
    Untracked,
    /// Recorded, but gone.
    Stale,
    /// Neither recorded nor on `PATH`.
    Absent,
    /// The recorded package manager could not say.
    Unknown(String),
    TimedOut,
}

/// One fresh lifecycle observation of an agent.
#[derive(Debug, Clone)]
pub struct View {
    pub agent: &'static Agent,
    pub methods: Vec<InstallMethod>,
    pub installed: Option<InstalledAgent>,
    /// The recorded source.
    pub binding: Option<Binding>,
    pub executable: Executable,
    pub status: Status,
}

impl View {
    pub fn present(&self) -> bool {
        matches!(self.status, Status::Managed | Status::Untracked)
    }
}

pub fn observe_lifecycle(ctx: &Context, agent: &'static Agent, state: &State) -> View {
    let summary = observe::observe(ctx, agent, state, ObserveOptions { latest_version: false });
    let mut executable = Executable {
        present: summary.present,
        path: summary.path,
        version: summary.version,
    };
    let installed = state.installed_agents.get(&agent.name).cloned();
    let binding = installed
        .as_ref()
        .and_then(|installed| Binding::from_installed(agent, installed));
    let status = match (&installed, &binding) {
        (None, _) if executable.present => Status::Untracked,
        (None, _) => Status::Absent,
        (Some(_), None) => Status::Unknown("The recorded install source cannot be resolved.".into()),
        (Some(_), Some(binding)) => match providers::observe(ctx, binding) {
            Observed::Present { version } => {
                // The package manager's version is the one an update moves.
                executable.version = version.or(executable.version);
                Status::Managed
            }
            Observed::Absent if executable.present => Status::Untracked,
            Observed::Absent => Status::Stale,
            Observed::TimedOut => Status::TimedOut,
            other => Status::Unknown(other.reason()),
        },
    };
    View {
        agent,
        methods: summary.methods,
        installed,
        binding,
        executable,
        status,
    }
}

#[derive(Debug, Clone)]
pub enum Decision {
    AlreadySatisfied,
    /// Present but untracked: record it if its source is clear.
    Adopt,
    Install,
    Blocked(String),
    Interrupted,
}

pub fn decide(view: &View) -> Decision {
    match &view.status {
        Status::Managed => Decision::AlreadySatisfied,
        Status::Untracked => Decision::Adopt,
        Status::Stale | Status::Absent => Decision::Install,
        Status::Unknown(reason) => Decision::Blocked(reason.clone()),
        Status::TimedOut => Decision::Interrupted,
    }
}

/// A chosen provider source and the state it will be recorded as.
#[derive(Debug, Clone)]
pub struct Recipe {
    pub binding: Binding,
    pub installed: InstalledAgent,
}

/// The first install method whose provider is available and whose target is absent.
/// A stale record's provider goes first, so a reinstall keeps its source when it can.
pub fn resolve_recipe(ctx: &Context, view: &View) -> Result<Recipe, String> {
    let agent = view.agent;
    let mut candidates: Vec<(InstallMethod, Binding)> = view
        .methods
        .iter()
        .filter_map(|method| Binding::from_method(agent, method).map(|binding| (method.clone(), binding)))
        .collect();
    if candidates.is_empty() {
        return Err(format!(
            "{} has no install recipe for {}.",
            agent.display_name,
            crate::catalog::Platform::current().as_str()
        ));
    }
    if let Some(recorded) = &view.binding {
        candidates.sort_by_key(|(method, _)| method.kind != recorded.provider);
    }
    let mut unavailable = Vec::new();
    for (method, binding) in &candidates {
        if !providers::available(binding.provider) {
            unavailable.push(format!("{0}: {0} executable is unavailable", binding.provider.as_str()));
            continue;
        }
        return match providers::observe(ctx, binding) {
            Observed::Absent => Ok(Recipe {
                binding: binding.clone(),
                installed: providers::installed_state_for_method(agent, method),
            }),
            Observed::Present { .. } => Err(format!(
                "{} is already installed through {}, but {} is not on PATH.",
                binding.target.id,
                binding.provider.as_str(),
                agent.binary_name
            )),
            other => Err(other.reason()),
        };
    }
    Err(format!(
        "No installation provider is currently available: {}",
        unavailable.join("; ")
    ))
}

/// Why installing an agent before launch did not succeed.
#[derive(Debug, Clone)]
pub enum LaunchInstallFailure {
    TimedOut,
    Failed(String),
}

/// Installs a missing agent so it can be launched.
pub fn install_for_launch(ctx: &Context, agent: &'static Agent) -> Result<(), LaunchInstallFailure> {
    match crate::commands::mutate::install_agent(ctx, &agent.name) {
        result if result.ok => Ok(()),
        _ if ctx.deadline_hit() => Err(LaunchInstallFailure::TimedOut),
        result => Err(LaunchInstallFailure::Failed(
            result.error.map(|error| error.message).unwrap_or_default(),
        )),
    }
}
