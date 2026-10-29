//! Install, ensure, update, and uninstall: observe, decide, execute, verify, record.

use std::path::PathBuf;

use serde_json::{Map, Value};

use crate::catalog::{Agent, InstallMethod, Provider};
use crate::context::Context;
use crate::observe::{self, ObserveOptions};
use crate::probe;
use crate::providers::{self, Binding, Observed};
use crate::store::{self, InstalledAgent, State};

/// Where the agent's executable is, as seen on `PATH` or in a known directory.
#[derive(Debug, Clone, Default)]
pub struct Executable {
    pub present: bool,
    pub path: Option<PathBuf>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Drift {
    None,
    Untracked,
    RecordedAbsent,
    ConflictingSource,
    Indeterminate(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Kind {
    Present,
    Absent,
    Indeterminate(String),
}

/// One fresh lifecycle observation of an agent.
#[derive(Debug, Clone)]
pub struct View {
    pub agent: &'static Agent,
    pub methods: Vec<InstallMethod>,
    pub installed: Option<InstalledAgent>,
    pub receipt: Option<Value>,
    /// What `PATH` shows.
    pub path_executable: Executable,
    /// `path_executable` merged with provider evidence.
    pub executable: Executable,
    pub binding: Option<Binding>,
    pub persisted_binding: Option<Binding>,
    pub kind: Kind,
    pub drift: Drift,
    pub interrupted: bool,
    /// What the provider reported for `binding`, when the observation probed it.
    pub provider_observed: Option<Observed>,
}

fn versions_conflict(left: Option<&str>, right: Option<&str>) -> bool {
    match (left, right) {
        (Some(left), Some(right)) => match probe::compare_versions(left, right) {
            Some(order) => order != std::cmp::Ordering::Equal,
            None => left != right,
        },
        _ => false,
    }
}

fn paths_conflict(left: Option<&str>, right: Option<&std::path::Path>) -> bool {
    let (Some(left), Some(right)) = (left, right) else {
        return false;
    };
    let left = PathBuf::from(left);
    if left == right {
        return false;
    }
    probe::real_path(&left) != probe::real_path(right)
}

fn merge(executable: &Executable, observed: &Observed) -> Executable {
    match observed {
        Observed::Present { version } => Executable {
            present: true,
            path: executable.path.clone(),
            version: executable.version.clone().or_else(|| version.clone()),
        },
        _ => executable.clone(),
    }
}

fn observed_version(observed: &Observed) -> Option<&str> {
    match observed {
        Observed::Present { version } => version.as_deref(),
        _ => None,
    }
}

/// v1 `observeAgentLifecycle`. `observation_binding` restricts the probe to one exact
/// catalog source, as post-mutation verification does.
pub fn observe_lifecycle(
    ctx: &Context,
    agent: &'static Agent,
    state: &State,
    observation_binding: Option<&Binding>,
) -> View {
    observe_lifecycle_with(ctx, agent, state, observation_binding, false)
}

/// `observe_lifecycle`, optionally treating an agent with no executable and no Quantex
/// record as absent without probing every catalog provider, as `update` does.
pub fn observe_lifecycle_with(
    ctx: &Context,
    agent: &'static Agent,
    state: &State,
    observation_binding: Option<&Binding>,
    skip_unrecorded_absent: bool,
) -> View {
    let summary = observe::observe(ctx, agent, state, ObserveOptions { latest_version: false });
    let executable = Executable {
        present: summary.present,
        path: summary.path.clone(),
        version: summary.version.clone(),
    };
    let installed = state.installed_agents.get(&agent.name).cloned();
    let receipt = state.lifecycle_receipts.get(&agent.name).cloned();
    let exe_name = agent.binary_name.as_str();
    let catalog = providers::catalog_bindings(agent);
    let unresolved_catalog = agent
        .install_methods()
        .iter()
        .any(|method| Binding::from_method(agent, method).is_none());
    let observation_binding = observation_binding
        .and_then(|requested| {
            catalog.iter().find(|candidate| {
                candidate.same_source(requested, exe_name) && candidate.target.arguments == requested.target.arguments
            })
        })
        .cloned();
    let observed_catalog: Vec<Binding> = match &observation_binding {
        Some(binding) => vec![binding.clone()],
        None => catalog.clone(),
    };
    let state_binding = installed
        .as_ref()
        .and_then(|installed| Binding::from_installed(agent, installed));
    let receipt_binding = receipt.as_ref().and_then(Binding::from_receipt);
    let persisted_binding = match (&state_binding, &receipt_binding) {
        (None, receipt) => receipt.clone(),
        (Some(state), None) => Some(state.clone()),
        (Some(state), Some(receipt)) => {
            if !state.same_source(receipt, exe_name) || state.target.arguments.is_empty() {
                Some(receipt.clone())
            } else {
                let mut merged = receipt.clone();
                merged.target.arguments = state.target.arguments.clone();
                Some(merged)
            }
        }
    };
    let mut view = View {
        agent,
        methods: summary.methods.clone(),
        installed: installed.clone(),
        receipt: receipt.clone(),
        path_executable: executable.clone(),
        executable: executable.clone(),
        binding: None,
        persisted_binding: persisted_binding.clone(),
        kind: Kind::Absent,
        drift: Drift::None,
        interrupted: false,
        provider_observed: None,
    };
    let indeterminate = |mut view: View, reason: &str| {
        view.kind = Kind::Indeterminate(reason.to_owned());
        view.drift = Drift::Indeterminate(reason.to_owned());
        view
    };
    let presence = |present: bool| if present { Kind::Present } else { Kind::Absent };

    if (installed.is_some() && state_binding.is_none()) || (receipt.is_some() && receipt_binding.is_none()) {
        return indeterminate(view, "Persisted provider binding cannot be resolved.");
    }
    if let (Some(state), Some(receipt)) = (&state_binding, &receipt_binding)
        && !state.same_source(receipt, exe_name)
    {
        view.kind = presence(executable.present);
        view.drift = Drift::ConflictingSource;
        return view;
    }

    if let Some(recorded) = &persisted_binding {
        let observed = providers::observe(ctx, recorded);
        view.binding = Some(recorded.clone());
        view.provider_observed = Some(observed.clone());
        if matches!(observed, Observed::TimedOut) {
            view.interrupted = true;
        }
        if !matches!(observed, Observed::Present { .. } | Observed::Absent) {
            let reason = observed.reason();
            return indeterminate(view, &reason);
        }
        if observed == Observed::Absent && !executable.present {
            view.kind = Kind::Absent;
            view.drift = Drift::RecordedAbsent;
            return view;
        }
        let receipt_version = receipt.as_ref().and_then(|receipt| receipt["version"].as_str());
        let receipt_path = receipt.as_ref().and_then(|receipt| receipt["executablePath"].as_str());
        let live_version = executable.version.as_deref().or(observed_version(&observed));
        let compare_receipt_path = matches!(recorded.target.kind, "script" | "binary");
        let receipt_path_conflicts = compare_receipt_path
            && !versions_conflict(receipt_version, live_version)
            && paths_conflict(receipt_path, executable.path.as_deref());
        let relocated = !compare_receipt_path && paths_conflict(receipt_path, executable.path.as_deref());
        let version_conflicts = matches!(observed, Observed::Present { .. })
            && versions_conflict(observed_version(&observed), executable.version.as_deref())
            && !relocated;
        let identities: std::collections::BTreeSet<&str> = [
            Some(exe_name),
            installed
                .as_ref()
                .and_then(|installed| installed.binary_name.as_deref()),
            receipt.as_ref().and_then(|receipt| receipt["executableName"].as_str()),
            recorded.target.binary_name.as_deref(),
        ]
        .into_iter()
        .flatten()
        .collect();
        let evidence_conflicts = matches!(observed, Observed::Absent) != !executable.present
            || version_conflicts
            || receipt_path_conflicts
            || identities.len() > 1;
        let mut merged = merge(&executable, &observed);
        if relocated && let Some(version) = observed_version(&observed) {
            merged.version = Some(version.to_owned());
        }
        view.executable = merged;
        view.kind = Kind::Present;
        view.drift = if evidence_conflicts {
            Drift::ConflictingSource
        } else {
            Drift::None
        };
        if !matches!(observed, Observed::Present { .. }) {
            view.binding = Some(recorded.clone());
        }
        return view;
    }

    if skip_unrecorded_absent && !executable.present && installed.is_none() && receipt.is_none() {
        view.kind = Kind::Absent;
        return view;
    }

    let outcomes: Vec<(Binding, Observed)> = std::thread::scope(|scope| {
        let handles: Vec<_> = observed_catalog
            .iter()
            .map(|binding| scope.spawn(move || (binding.clone(), providers::observe(ctx, binding))))
            .collect();
        handles.into_iter().map(|handle| handle.join().unwrap()).collect()
    });
    let live: Vec<&(Binding, Observed)> = outcomes
        .iter()
        .filter(|(_, observed)| matches!(observed, Observed::Present { .. }))
        .collect();
    let exact: Vec<&(Binding, Observed)> = outcomes
        .iter()
        .filter(|(binding, _)| binding.provider.is_managed())
        .collect();
    let exact_live: Vec<&(Binding, Observed)> = exact
        .iter()
        .copied()
        .filter(|(_, observed)| matches!(observed, Observed::Present { .. }))
        .collect();
    let exact_unresolved = exact.iter().any(|(_, observed)| observed.is_inconclusive());
    let authoritative: Vec<&(Binding, Observed)> = if !exact_live.is_empty() {
        exact_live
    } else if exact_unresolved {
        Vec::new()
    } else {
        live.clone()
    };
    if authoritative.len() > 1 {
        if executable.present {
            view.kind = Kind::Present;
            view.drift = Drift::ConflictingSource;
            return view;
        }
        view.kind = Kind::Indeterminate("Multiple catalog providers report the agent as present.".into());
        view.drift = Drift::ConflictingSource;
        return view;
    }
    if observation_binding.is_none() && unresolved_catalog {
        return indeterminate(view, "A catalog provider binding cannot be resolved.");
    }
    let unresolved = outcomes.iter().find(|(_, observed)| observed.is_inconclusive());
    if let Some((_, observed)) = outcomes
        .iter()
        .find(|(_, observed)| matches!(observed, Observed::TimedOut))
    {
        view.interrupted = true;
        return indeterminate(view, &observed.reason());
    }
    if let Some((binding, observed)) = authoritative.first() {
        let merged = merge(&executable, observed);
        let conflicts =
            !executable.present || versions_conflict(observed_version(observed), executable.version.as_deref());
        view.binding = Some(binding.clone());
        view.provider_observed = Some(observed.clone());
        view.executable = merged;
        view.kind = Kind::Present;
        view.drift = if conflicts {
            Drift::ConflictingSource
        } else {
            Drift::Untracked
        };
        return view;
    }
    let preferred = observation_binding.clone().or_else(|| {
        view.methods
            .first()
            .and_then(|method| Binding::from_method(agent, method))
    });
    let absent_preferred = preferred.as_ref().is_some_and(|preferred| {
        outcomes
            .iter()
            .any(|(binding, observed)| binding.same_source(preferred, exe_name) && *observed == Observed::Absent)
    });
    if !executable.present && live.is_empty() && unresolved.is_some() && absent_preferred {
        view.kind = Kind::Absent;
        return view;
    }
    let bun_absent = outcomes
        .iter()
        .any(|(binding, observed)| binding.provider == Provider::Bun && *observed == Observed::Absent);
    let in_bun_bin = executable
        .path
        .as_ref()
        .is_some_and(|path| path.to_string_lossy().replace('\\', "/").contains("/.bun/bin/"));
    if executable.present && in_bun_bin && live.is_empty() && bun_absent && !exact_unresolved {
        view.kind = Kind::Absent;
        return view;
    }
    if let Some((_, observed)) = unresolved {
        let reason = observed.reason();
        return indeterminate(view, &reason);
    }
    view.kind = presence(executable.present);
    view.drift = if executable.present {
        Drift::Untracked
    } else {
        Drift::None
    };
    view
}

/// v1 `decideCoreInstallation`.
#[derive(Debug, Clone)]
pub enum Decision {
    AlreadySatisfied,
    ExternalPreserved,
    Install,
    Reinstall(Binding),
    Blocked(String),
    Interrupted,
}

pub fn decide(view: &View) -> Decision {
    if view.interrupted {
        return Decision::Interrupted;
    }
    if view.drift == Drift::ConflictingSource {
        return Decision::Blocked("Live and recorded installation evidence conflict.".into());
    }
    if let Kind::Indeterminate(reason) = &view.kind {
        return Decision::Blocked(reason.clone());
    }
    if let Drift::Indeterminate(reason) = &view.drift {
        return Decision::Blocked(reason.clone());
    }
    if view.kind == Kind::Present {
        if view.drift == Drift::Untracked {
            return Decision::ExternalPreserved;
        }
        if view.persisted_binding.is_none() && view.binding.is_none() {
            return Decision::Blocked("A present managed installation has no resolvable source evidence.".into());
        }
        return Decision::AlreadySatisfied;
    }
    if view.drift == Drift::RecordedAbsent {
        return match &view.persisted_binding {
            Some(binding) => Decision::Reinstall(binding.clone()),
            None => {
                Decision::Blocked("Recorded installation evidence cannot be resolved to a supported source.".into())
            }
        };
    }
    Decision::Install
}

/// A chosen provider source and the state it will be recorded as.
#[derive(Debug, Clone)]
pub struct Recipe {
    pub binding: Binding,
    pub installed: InstalledAgent,
}

/// v1 `resolveCoreInstallationRecipe`: the first ordered method whose provider is
/// available and whose target is confirmed absent; for a reinstall, the exact
/// recorded source only.
pub fn resolve_recipe(ctx: &Context, view: &View, decision: &Decision) -> Result<Recipe, String> {
    let agent = view.agent;
    let exe_name = agent.binary_name.as_str();
    let candidates: Vec<(InstallMethod, Binding)> = view
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
    let probe = |method: &InstallMethod, binding: &Binding, allow_fallback: bool| -> Result<Recipe, String> {
        if !providers::available(binding.provider) {
            let reason = format!("{0}: {0} executable is unavailable", binding.provider.as_str());
            return Err(if allow_fallback {
                format!("provider-unavailable:{reason}")
            } else {
                format!("The exact recorded provider is unavailable: {reason}")
            });
        }
        match providers::observe(ctx, binding) {
            Observed::Absent => Ok(Recipe {
                binding: binding.clone(),
                installed: providers::installed_state_for_method(agent, method, true),
            }),
            Observed::Present { .. } => Err(format!(
                "Provider {} reports the selected target became present before mutation.",
                binding.provider.as_str()
            )),
            other => Err(other.reason()),
        }
    };
    if let Decision::Reinstall(required) = decision {
        let exact: Vec<&(InstallMethod, Binding)> = candidates
            .iter()
            .filter(|(_, binding)| binding.same_source(required, exe_name))
            .collect();
        return match exact.as_slice() {
            [(method, binding)] => probe(method, binding, false),
            [] => Err("The exact recorded source is no longer present in the mutation catalog.".into()),
            _ => Err("The mutation catalog contains multiple recipes for the exact recorded source.".into()),
        };
    }
    let mut unavailable = Vec::new();
    for (method, binding) in &candidates {
        match probe(method, binding, true) {
            Ok(recipe) => return Ok(recipe),
            Err(reason) => match reason.strip_prefix("provider-unavailable:") {
                Some(reason) => unavailable.push(reason.to_owned()),
                None => return Err(reason),
            },
        }
    }
    Err(if unavailable.is_empty() {
        "No usable install recipe is available.".into()
    } else {
        format!(
            "No installation provider is currently available: {}",
            unavailable.join("; ")
        )
    })
}

/// The receipt v1 recorded after verifying a source.
pub fn receipt(view: &View, binding: &Binding) -> Value {
    let mut map = Map::new();
    if let Some(name) = &binding.target.binary_name {
        map.insert("executableName".into(), name.clone().into());
    }
    if let Some(path) = &view.executable.path {
        map.insert("executablePath".into(), path.to_string_lossy().into_owned().into());
    }
    map.insert("kind".into(), "lifecycle-receipt".into());
    map.insert("providerId".into(), binding.provider.as_str().into());
    map.insert("providerTargetId".into(), binding.target.id.clone().into());
    map.insert("providerTargetKind".into(), binding.target.kind.into());
    map.insert("schemaVersion".into(), store::RECEIPT_SCHEMA_VERSION.into());
    map.insert("targetId".into(), view.agent.name.clone().into());
    map.insert("verifiedAt".into(), crate::time::now_iso().into());
    if let Some(version) = &view.executable.version {
        map.insert("version".into(), version.clone().into());
    }
    Value::Object(map)
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
