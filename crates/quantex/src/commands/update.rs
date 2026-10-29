//! `update`: one agent, `--all`, or `--all --managed`.
//!
//! Each target is observed, planned against a confirmed recorded source, executed under
//! the lifecycle lock, verified by a fresh observation, and recorded as a receipt.

use serde_json::{Map, Value, json};

use crate::catalog::{self, Agent, Provider};
use crate::context::Context;
use crate::lifecycle::{self, Drift, Kind, View};
use crate::observe::{self, UpdateStrategy};
use crate::protocol::{self, CommandError, ErrorCode, EventType, Outcome, Target, TargetKind, Warning};
use crate::providers::{self, Binding, MutationFailure};
use crate::store::{self, State};
use crate::term::Human;
use crate::{net, probe};

const LIFECYCLE_LOCK: &str = "agent lifecycle";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Blocked {
    StaleState,
    Untracked,
    UnsafeSource,
    Superseded,
    ManualRequired,
}

#[derive(Debug, Clone)]
enum Strategy {
    Managed {
        target_version: String,
    },
    SelfUpdate {
        before_version: String,
        commands: Vec<Vec<String>>,
    },
}

/// v1 `planLifecycleUpdate` decisions a confirmed npm or bun source can reach.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Decision {
    Upgrade,
    UpToDate,
    BlockedDowngrade,
    Indeterminate,
}

#[derive(Debug, Clone)]
struct Plan {
    before: View,
    binding: Binding,
    strategy: Strategy,
    decision: Decision,
}

impl Plan {
    fn latest_version(&self) -> Option<String> {
        match &self.strategy {
            Strategy::Managed { target_version } => Some(target_version.clone()),
            Strategy::SelfUpdate { .. } => None,
        }
    }

    fn strategy_label(&self) -> String {
        match self.strategy {
            Strategy::Managed { .. } => format!("managed/{}", self.binding.provider.as_str()),
            Strategy::SelfUpdate { .. } => "self-update".into(),
        }
    }
}

#[derive(Debug, Clone)]
enum Planning {
    UnknownAgent,
    Blocked {
        before: View,
        category: Blocked,
        reason: String,
    },
    ProviderFailed {
        before: View,
    },
    TimedOut {
        before: View,
    },
    Cancelled {
        before: View,
    },
    Planned(Box<Plan>),
}

impl Planning {
    fn before(&self) -> Option<&View> {
        match self {
            Self::UnknownAgent => None,
            Self::Blocked { before, .. }
            | Self::ProviderFailed { before }
            | Self::TimedOut { before }
            | Self::Cancelled { before } => Some(before),
            Self::Planned(plan) => Some(&plan.before),
        }
    }
}

#[derive(Debug, Clone)]
enum Execution {
    NotExecuted,
    DryRun,
    /// `receipt` is what was recorded after the update was verified.
    Updated {
        receipt: Value,
    },
    UpToDate {
        receipt: Value,
    },
    ProviderFailed,
    TimedOut,
    Cancelled,
    Unsatisfied(String),
    ReceiptFailed(String),
    Locked {
        message: String,
        resource: String,
    },
}

// ---------------------------------------------------------------------------
// Planning

fn observe_for_update(ctx: &Context, agent: &'static Agent, state: &State) -> View {
    lifecycle::observe_lifecycle_with(ctx, agent, state, None, true)
}

/// v1 `confirmedBinding`: the recorded source, when a fresh observation agrees with it.
fn confirmed_binding(view: &View) -> Option<Binding> {
    let binding = view.binding.as_ref()?;
    let persisted = view.persisted_binding.as_ref()?;
    if view.kind != Kind::Present || view.drift != Drift::None {
        return None;
    }
    binding
        .same_source(persisted, &view.agent.binary_name)
        .then(|| binding.clone())
}

fn tracked_unmanaged(view: &View) -> bool {
    view.installed
        .as_ref()
        .is_some_and(|installed| matches!(installed.install_type, Provider::Script | Provider::Binary))
}

fn decide(view: &View, target_version: &str) -> Decision {
    let Some(version) = view.executable.version.as_deref() else {
        return Decision::Indeterminate;
    };
    match probe::compare_versions(target_version, version) {
        Some(std::cmp::Ordering::Greater) => Decision::Upgrade,
        Some(std::cmp::Ordering::Equal) => Decision::UpToDate,
        Some(std::cmp::Ordering::Less) => Decision::BlockedDowngrade,
        None => Decision::Indeterminate,
    }
}

fn plan(ctx: &Context, name: &str, state: &State) -> Planning {
    let Some(agent) = catalog::find(name) else {
        return Planning::UnknownAgent;
    };
    let before = observe_for_update(ctx, agent, state);
    if ctx.is_cancelled() {
        return Planning::Cancelled { before };
    }
    let Some(binding) = confirmed_binding(&before) else {
        let stale = before.kind == Kind::Absent && before.drift == Drift::RecordedAbsent;
        let (category, reason) = if stale {
            (
                Blocked::StaleState,
                format!(
                    "{} has stale lifecycle evidence. Run `quantex uninstall {}` to reconcile it.",
                    agent.display_name, agent.name
                ),
            )
        } else {
            let category = if before.drift == Drift::Untracked {
                Blocked::Untracked
            } else {
                Blocked::UnsafeSource
            };
            (
                category,
                "The recorded update source does not match live provider evidence.".to_owned(),
            )
        };
        return Planning::Blocked {
            before,
            category,
            reason,
        };
    };
    // The recorded package no longer receives releases, so its latest version says nothing.
    if let Some(warning) = observe::superseded_warning(agent, before.installed.as_ref()) {
        return Planning::Blocked {
            before,
            category: Blocked::Superseded,
            reason: warning.message,
        };
    }
    if tracked_unmanaged(&before)
        && let Some(self_update) = &agent.self_update
    {
        let Some(before_version) = before.executable.version.clone() else {
            let reason = format!(
                "Cannot verify {} self-update because its installed version is unknown.",
                agent.display_name
            );
            return Planning::Blocked {
                before,
                category: Blocked::ManualRequired,
                reason,
            };
        };
        let commands = std::iter::once(self_update.command.clone())
            .chain(self_update.fallback_commands.iter().cloned())
            .collect();
        return Planning::Planned(Box::new(Plan {
            before,
            binding,
            strategy: Strategy::SelfUpdate {
                before_version,
                commands,
            },
            decision: Decision::Upgrade,
        }));
    }
    if !binding.provider.can_lookup_latest() {
        let reason = format!(
            "Provider {} cannot resolve an update target version.",
            binding.provider.as_str()
        );
        return Planning::Blocked {
            before,
            category: Blocked::ManualRequired,
            reason,
        };
    }
    let Some(target_version) = net::latest_npm_version(ctx, &binding.target.id, "latest", &net::npm_registry()) else {
        if ctx.is_cancelled() {
            return Planning::Cancelled { before };
        }
        if ctx.deadline_hit() {
            return Planning::TimedOut { before };
        }
        return Planning::ProviderFailed { before };
    };
    let decision = decide(&before, &target_version);
    Planning::Planned(Box::new(Plan {
        before,
        binding,
        strategy: Strategy::Managed { target_version },
        decision,
    }))
}

// ---------------------------------------------------------------------------
// Execution

fn mutation_failure(failure: MutationFailure) -> Execution {
    match failure {
        MutationFailure::TimedOut => Execution::TimedOut,
        MutationFailure::Cancelled => Execution::Cancelled,
        MutationFailure::Failed(_) => Execution::ProviderFailed,
    }
}

fn execute(ctx: &Context, plan: &Plan) -> Execution {
    if plan.decision != Decision::Upgrade {
        return Execution::NotExecuted;
    }
    if ctx.dry_run {
        return Execution::DryRun;
    }
    if ctx.is_cancelled() {
        return Execution::Cancelled;
    }
    let dir = ctx.quantex_dir();
    let _lock = match store::acquire_lock(&dir, LIFECYCLE_LOCK, &["agent-lifecycle"]) {
        Ok(lock) => lock,
        Err(error) => {
            let resource = error.resource.clone();
            return Execution::Locked {
                message: error.into_command_error().message,
                resource,
            };
        }
    };
    let agent = plan.before.agent;
    let ran = match &plan.strategy {
        Strategy::Managed { .. } => run_provider_update(ctx, &plan.binding),
        Strategy::SelfUpdate { commands, .. } => run_self_update(ctx, commands),
    };
    if let Err(failure) = ran {
        return mutation_failure(failure);
    }
    if ctx.is_cancelled() {
        return Execution::Cancelled;
    }
    let state = match store::load_state(&dir) {
        Ok(state) => state,
        Err(error) => return Execution::Unsatisfied(error.into_command_error().message),
    };
    let after = observe_for_update(ctx, agent, &state);
    if ctx.is_cancelled() {
        return Execution::Cancelled;
    }
    let changed = match verify(plan, &after) {
        Ok(changed) => changed,
        Err(reason) => return Execution::Unsatisfied(reason),
    };
    let receipt = update_receipt(&after, &plan.binding);
    let name = agent.name.clone();
    if let Err(error) = store::mutate_state(&dir, |state| {
        state.lifecycle_receipts.insert(name.clone(), receipt.clone());
    }) {
        return Execution::ReceiptFailed(error.into_command_error().message);
    }
    if changed {
        Execution::Updated { receipt }
    } else {
        Execution::UpToDate { receipt }
    }
}

fn run_provider_update(ctx: &Context, binding: &Binding) -> Result<(), MutationFailure> {
    let config = store::load_config(&ctx.quantex_dir());
    let latest_major = config.npm_bun_update_strategy() != "respect-semver";
    let Some(command) = providers::update_command(binding, latest_major, "latest") else {
        return Err(MutationFailure::Failed(format!(
            "Provider {} does not support update.",
            binding.provider.as_str()
        )));
    };
    providers::run_mutation(ctx, &command, &format!("{} update failed", binding.provider.as_str()))?;
    if binding.provider == Provider::Bun {
        providers::trust_bun_packages(ctx, std::slice::from_ref(&binding.target.id))?;
    }
    Ok(())
}

/// v1 `executeAgentSelfUpdate`: the first command that succeeds wins.
fn run_self_update(ctx: &Context, commands: &[Vec<String>]) -> Result<(), MutationFailure> {
    let mut last = MutationFailure::Failed("No self-update command is configured.".into());
    for command in commands {
        match providers::run_mutation(ctx, command, "agent self-update failed") {
            Ok(()) => return Ok(()),
            Err(failure @ (MutationFailure::TimedOut | MutationFailure::Cancelled)) => return Err(failure),
            Err(failure) => last = failure,
        }
    }
    Err(last)
}

fn drift_label(drift: &Drift) -> &'static str {
    match drift {
        Drift::None => "none",
        Drift::Untracked => "untracked",
        Drift::RecordedAbsent => "recorded-absent",
        Drift::ConflictingSource => "conflicting-source",
        Drift::Indeterminate(_) => "indeterminate",
    }
}

/// v1 `verifyUpdatedObservation` / `verifySelfUpdatedObservation`. Returns whether the
/// version moved.
fn verify(plan: &Plan, after: &View) -> Result<bool, String> {
    let exe = after.agent.binary_name.as_str();
    let same = after
        .binding
        .as_ref()
        .is_some_and(|binding| binding.same_source(&plan.binding, exe));
    let version = after.executable.version.as_deref();
    match &plan.strategy {
        Strategy::Managed { target_version } => {
            if !same {
                return Err("Fresh observation no longer matches the planned provider binding.".into());
            }
            if after.drift != Drift::None {
                return Err(format!(
                    "Fresh observation contains {} drift.",
                    drift_label(&after.drift)
                ));
            }
            if after.kind != Kind::Present || !after.executable.present {
                return Err("The provider target or executable is not present after update.".into());
            }
            let satisfied = version
                .and_then(|version| probe::compare_versions(version, target_version))
                .is_some_and(|order| order != std::cmp::Ordering::Less);
            if !satisfied {
                return Err(format!(
                    "Observed version {} does not satisfy target {target_version}.",
                    version.unwrap_or("unknown")
                ));
            }
            Ok(true)
        }
        Strategy::SelfUpdate { before_version, .. } => {
            if !same || after.drift != Drift::None {
                return Err("Fresh observation no longer matches the recorded self-update source.".into());
            }
            if after.kind != Kind::Present || !after.executable.present {
                return Err("The executable is not present after self-update.".into());
            }
            match version.and_then(|version| probe::compare_versions(version, before_version)) {
                Some(order) if order != std::cmp::Ordering::Less => Ok(order == std::cmp::Ordering::Greater),
                _ => Err(format!(
                    "Observed version {} cannot verify self-update from {before_version}.",
                    version.unwrap_or("unknown")
                )),
            }
        }
    }
}

/// The receipt v1 records after a verified update; it always names the executable.
fn update_receipt(after: &View, binding: &Binding) -> Value {
    let mut receipt = lifecycle::receipt(after, binding);
    receipt["executableName"] = after.agent.binary_name.clone().into();
    receipt
}

// ---------------------------------------------------------------------------
// Results

struct Item(Map<String, Value>);

impl Item {
    fn new(display_name: &str, name: &str, status: &str) -> Self {
        let mut map = Map::new();
        map.insert("displayName".into(), display_name.into());
        map.insert("name".into(), name.into());
        map.insert("status".into(), status.into());
        Self(map)
    }

    fn set(mut self, key: &str, value: Option<impl Into<Value>>) -> Self {
        if let Some(value) = value {
            self.0.insert(key.into(), value.into());
        }
        self
    }

    fn status(&self) -> &str {
        self.0["status"].as_str().unwrap_or_default()
    }

    fn into_value(self) -> Value {
        Value::Object(self.0)
    }
}

fn receipt_version(receipt: &Value) -> Option<String> {
    receipt["version"].as_str().map(str::to_owned)
}

fn installed_version(view: &View) -> Option<String> {
    (view.kind == Kind::Present)
        .then(|| view.executable.version.clone())
        .flatten()
}

fn manual_message(agent: &Agent) -> String {
    format!(
        "{} uses a manually managed install source. Please check for updates manually.",
        agent.display_name
    )
}

fn untracked_message(agent: &Agent) -> String {
    format!(
        "{} is detected on disk but not tracked as a Quantex-managed install. Use `quantex inspect {} --json` to confirm the source, then reinstall through Quantex if you want `quantex update --all` to manage it.",
        agent.display_name, agent.name
    )
}

fn timed_out_message(ctx: &Context) -> String {
    format!("Update timed out after {}ms.", ctx.timeout_ms.unwrap_or_default())
}

const CANCELLED_MESSAGE: &str = "Update was cancelled before it could complete.";

/// v1 `toSingleUpdateResult`.
fn result_item(ctx: &Context, agent: &Agent, planning: &Planning, execution: Option<&Execution>) -> Item {
    let (display, name) = (agent.display_name.as_str(), agent.name.as_str());
    let Some(before) = planning.before() else {
        return Item::new(display, name, "failed");
    };
    let installed = installed_version(before);
    let Planning::Planned(plan) = planning else {
        let provider = before.binding.as_ref().map(|binding| binding.provider.as_str());
        return match planning {
            Planning::Blocked { category, reason, .. } => {
                let (status, message) = match category {
                    Blocked::Untracked => ("manual-required", untracked_message(agent)),
                    Blocked::ManualRequired => ("manual-required", manual_message(agent)),
                    Blocked::Superseded => ("manual-required", reason.clone()),
                    Blocked::StaleState | Blocked::UnsafeSource => ("failed", reason.clone()),
                };
                Item::new(display, name, status)
                    .set("installedVersion", installed)
                    .set("message", Some(message))
            }
            Planning::Cancelled { .. } => Item::new(display, name, "failed")
                .set("installedVersion", installed)
                .set("message", Some(CANCELLED_MESSAGE))
                .set("strategy", provider),
            Planning::TimedOut { .. } => Item::new(display, name, "failed")
                .set("installedVersion", installed)
                .set("message", Some(timed_out_message(ctx)))
                .set("strategy", provider),
            _ => Item::new(display, name, "failed")
                .set("installedVersion", installed)
                .set("strategy", provider),
        };
    };
    let latest = plan.latest_version();
    let strategy = Some(plan.strategy_label());
    let base = |status: &str| {
        Item::new(display, name, status)
            .set("installedVersion", installed.clone())
            .set("latestVersion", latest.clone())
    };
    match execution.unwrap_or(&Execution::NotExecuted) {
        Execution::Updated { receipt, .. } => Item::new(display, name, "updated")
            .set("installedVersion", installed.clone())
            .set("latestVersion", receipt_version(receipt).or(latest.clone()))
            .set("strategy", strategy),
        Execution::UpToDate { receipt, .. } => Item::new(display, name, "up-to-date")
            .set("installedVersion", receipt_version(receipt).or(installed.clone()))
            .set("strategy", strategy),
        Execution::DryRun => base("planned")
            .set("message", Some(format!("Dry run: would update {display}.")))
            .set("strategy", strategy),
        Execution::NotExecuted if plan.decision == Decision::UpToDate => base("up-to-date"),
        Execution::NotExecuted => base("manual-required").set("message", Some(manual_message(agent))),
        Execution::Cancelled => base("failed")
            .set("message", Some(CANCELLED_MESSAGE))
            .set("strategy", strategy),
        Execution::TimedOut => base("failed")
            .set("message", Some(timed_out_message(ctx)))
            .set("strategy", strategy),
        Execution::ProviderFailed => base("failed").set("strategy", strategy),
        Execution::Unsatisfied(reason) | Execution::ReceiptFailed(reason) => base("failed")
            .set("message", Some(reason.clone()))
            .set("strategy", strategy),
        Execution::Locked { message, resource } => base("locked")
            .set("message", Some(message.clone()))
            .set("resource", Some(resource.clone()))
            .set("strategy", strategy),
    }
}

fn failure_hint(agent: &Agent, before: &View) -> Option<String> {
    match observe::update_strategy(agent, before.installed.as_ref(), &before.methods) {
        UpdateStrategy::SelfUpdate => agent
            .self_update
            .as_ref()
            .map(|self_update| format!("Try running {} directly.", self_update.command.join(" "))),
        UpdateStrategy::ManualHint => Some(format!("Check {} for the recommended update path.", agent.homepage)),
        UpdateStrategy::Managed => None,
    }
}

fn stale_state_warning(agent: &Agent) -> Warning {
    Warning::new(
        "AGENT_STALE_STATE",
        format!(
            "{} is not installed but has stale lifecycle evidence. Run `quantex uninstall {}` to reconcile it.",
            agent.display_name, agent.name
        ),
    )
    .details(json!({
        "agentName": agent.name,
        "suggestedAction": "reconcile-agent-state",
        "suggestedCommands": [format!("quantex uninstall {}", agent.name)],
    }))
}

fn push_result(ctx: &Context, results: &mut Vec<Value>, item: Item) {
    let name = item.0["name"].as_str().unwrap_or_default().to_owned();
    let value = item.into_value();
    protocol::emit_event(
        ctx,
        "update",
        EventType::Progress,
        value.clone(),
        Some(&Target::agent(&name)),
    );
    results.push(value);
}

fn any_agent() -> Target {
    Target::new(TargetKind::Agent, None::<String>)
}

// ---------------------------------------------------------------------------
// Commands

pub fn update(ctx: &Context, input: Option<&str>, all: bool, managed: bool) -> Outcome {
    if managed && !all {
        return Outcome::failure(
            "update",
            Some(any_agent()),
            CommandError::new(ErrorCode::InvalidArgument, "The --managed option requires --all."),
        )
        .with_human(render);
    }
    if all {
        let scope = if managed { "managed" } else { "all" };
        return update_all(ctx, scope).with_human(render);
    }
    let Some(input) = input else {
        return Outcome::failure(
            "update",
            Some(any_agent()),
            CommandError::new(
                ErrorCode::InvalidArgument,
                "Please specify an agent name or use --all flag",
            ),
        )
        .with_human(render);
    };
    let Some(agent) = catalog::find(input) else {
        return Outcome::failure(
            "update",
            Some(Target::agent(input)),
            CommandError::new(ErrorCode::AgentNotFound, format!("Unknown agent: {input}"))
                .details(json!({ "input": input })),
        )
        .with_human(render);
    };
    update_single(ctx, agent).with_human(render)
}

fn plan_single(ctx: &Context, input: &str) -> Result<Planning, Outcome> {
    if catalog::find(input).is_none() {
        return Ok(Planning::UnknownAgent);
    }
    let state = store::load_state(&ctx.quantex_dir())
        .map_err(|error| Outcome::failure("update", Some(Target::agent(input)), error.into_command_error()))?;
    Ok(plan(ctx, input, &state))
}

fn update_single(ctx: &Context, agent: &'static Agent) -> Outcome {
    let target = Target::agent(&agent.name);
    protocol::emit_event(
        ctx,
        "update",
        EventType::Started,
        json!({ "agent": agent.name, "scope": "single" }),
        Some(&target),
    );
    let planning = match plan_single(ctx, &agent.name) {
        Ok(planning) => planning,
        Err(outcome) => return outcome,
    };
    let execution = match &planning {
        Planning::Planned(plan) => Some(execute(ctx, plan)),
        _ => None,
    };
    single_outcome(ctx, agent, target, &planning, execution.as_ref())
}

fn single_outcome(
    ctx: &Context,
    agent: &'static Agent,
    target: Target,
    planning: &Planning,
    execution: Option<&Execution>,
) -> Outcome {
    if let Some(Execution::Locked { message, resource }) = execution {
        let locked = Item::new(&agent.display_name, &agent.name, "locked")
            .set("message", Some(message.clone()))
            .set("resource", Some(resource.clone()));
        return Outcome::failure(
            "update",
            Some(target),
            CommandError::new(ErrorCode::ResourceLocked, message.clone()).details(json!({ "resource": resource })),
        )
        .with_data(json!({ "results": [locked.into_value()], "scope": "single" }));
    }
    if let Some(before) = planning.before()
        && before.kind == Kind::Absent
    {
        let outcome = Outcome::failure(
            "update",
            Some(target),
            CommandError::new(
                ErrorCode::AgentNotInstalled,
                format!("{} is not installed.", agent.display_name),
            ),
        );
        return if before.drift == Drift::RecordedAbsent {
            outcome.with_warning(stale_state_warning(agent))
        } else {
            outcome
        };
    }
    let item = result_item(ctx, agent, planning, execution);
    let status = item.status().to_owned();
    let mut results = Vec::new();
    push_result(ctx, &mut results, item);
    let data = json!({ "results": results, "scope": "single" });
    let cancelled = matches!(planning, Planning::Cancelled { .. }) || matches!(execution, Some(Execution::Cancelled));
    if cancelled {
        return Outcome::failure(
            "update",
            Some(target),
            CommandError::new(
                ErrorCode::Cancelled,
                format!("Update of {} was cancelled.", agent.display_name),
            ),
        )
        .with_data(data);
    }
    if status == "failed" || status == "locked" {
        return Outcome::failure(
            "update",
            Some(target),
            CommandError::new(
                ErrorCode::UpdateFailed,
                format!("Failed to update {}.", agent.display_name),
            ),
        )
        .with_data(data);
    }
    let mut outcome = Outcome::success("update", Some(target), data);
    if let Planning::Blocked {
        category: Blocked::Superseded,
        before,
        ..
    } = planning
        && let Some(warning) = observe::superseded_warning(agent, before.installed.as_ref())
    {
        outcome = outcome.with_warning(warning);
    }
    outcome
}

/// v1 `isCatalogOnlyAbsentTarget`: a catalog agent with nothing on disk and no record.
fn catalog_only_absent(planning: &Planning) -> bool {
    planning
        .before()
        .is_some_and(|before| !before.executable.present && before.installed.is_none() && before.receipt.is_none())
}

/// Plans every batch target. Planning only reads, so targets are observed at once.
fn plan_all(ctx: &Context, scope: &str) -> Result<Vec<(String, Planning)>, Outcome> {
    let state = store::load_state(&ctx.quantex_dir())
        .map_err(|error| Outcome::failure("update", Some(any_agent()), error.into_command_error()))?;
    let mut names: Vec<String> = if scope == "managed" {
        state.installed_agents.keys().cloned().collect()
    } else {
        catalog::agents().iter().map(|agent| agent.name.clone()).collect()
    };
    names.sort();
    names.dedup();
    let planned: Vec<(String, Planning)> = std::thread::scope(|threads| {
        let handles: Vec<_> = names
            .iter()
            .map(|name| {
                let state = &state;
                threads.spawn(move || (name.clone(), plan(ctx, name, state)))
            })
            .collect();
        handles.into_iter().map(|handle| handle.join().unwrap()).collect()
    });
    Ok(planned
        .into_iter()
        .filter(|(_, planning)| !catalog_only_absent(planning))
        .collect())
}

/// Runs a batch in order.
fn update_all(ctx: &Context, scope: &str) -> Outcome {
    protocol::emit_event(
        ctx,
        "update",
        EventType::Started,
        json!({ "scope": scope }),
        Some(&any_agent()),
    );
    if !ctx.output_mode.is_structured() {
        Human::new(ctx).line("Checking installed agents...");
    }
    let targets = match plan_all(ctx, scope) {
        Ok(targets) => targets,
        Err(outcome) => return outcome,
    };

    let mut warnings = Vec::new();
    for (name, planning) in &targets {
        let Planning::Blocked { before, category, .. } = planning else {
            continue;
        };
        let agent = catalog::find(name).unwrap_or(before.agent);
        match category {
            Blocked::StaleState => warnings.push(stale_state_warning(agent)),
            Blocked::Superseded => warnings.extend(observe::superseded_warning(agent, before.installed.as_ref())),
            _ => {}
        }
    }

    let mut results = Vec::new();
    let mut cancelled = false;
    for (name, planning) in targets {
        batch_target(ctx, &name, &planning, &mut cancelled, &mut results);
    }

    let data = json!({ "results": results, "scope": scope });
    let mut outcome = if cancelled || ctx.is_cancelled() {
        Outcome::failure(
            "update",
            Some(any_agent()),
            CommandError::new(
                ErrorCode::Cancelled,
                "Update was cancelled before all agents could be updated.",
            ),
        )
        .with_data(data)
    } else if results
        .iter()
        .any(|result| matches!(result["status"].as_str(), Some("failed" | "locked")))
    {
        Outcome::failure(
            "update",
            Some(any_agent()),
            CommandError::new(ErrorCode::UpdateFailed, "One or more agents failed to update."),
        )
        .with_data(data)
    } else {
        Outcome::success("update", Some(any_agent()), data)
    };
    for warning in warnings {
        outcome = outcome.with_warning(warning);
    }
    outcome
}

/// Executes one batch target and appends its result, unless it is stale state.
fn batch_target(
    ctx: &Context,
    name: &str,
    planning: &Planning,
    cancelled: &mut bool,
    results: &mut Vec<Value>,
) -> Option<Execution> {
    let Some(agent) = catalog::find(name) else {
        push_result(ctx, results, Item::new(name, name, "failed"));
        return None;
    };
    if matches!(
        planning,
        Planning::Blocked {
            category: Blocked::StaleState,
            ..
        }
    ) {
        return None;
    }
    let execution = match planning {
        Planning::Planned(plan) if *cancelled || ctx.is_cancelled() => {
            *cancelled = true;
            let item = Item::new(&agent.display_name, &agent.name, "failed")
                .set("installedVersion", installed_version(&plan.before))
                .set("latestVersion", plan.latest_version())
                .set("message", Some("Update was cancelled before it could start."))
                .set("strategy", Some(plan.strategy_label()));
            push_result(ctx, results, item);
            return None;
        }
        Planning::Planned(plan) => Some(execute(ctx, plan)),
        Planning::Cancelled { .. } => {
            *cancelled = true;
            None
        }
        _ => None,
    };
    if matches!(execution, Some(Execution::Cancelled)) {
        *cancelled = true;
    }
    let provider_failed =
        matches!(planning, Planning::ProviderFailed { .. }) || matches!(execution, Some(Execution::ProviderFailed));
    let mut item = result_item(ctx, agent, planning, execution.as_ref());
    if provider_failed
        && item.status() == "failed"
        && let Some(before) = planning.before()
    {
        item = item.set("hint", failure_hint(agent, before));
    }
    push_result(ctx, results, item);
    execution
}

// ---------------------------------------------------------------------------
// Human output

fn version_hint(item: &Value) -> String {
    match item["installedVersion"].as_str() {
        Some(installed) => format!(
            " ({installed} -> {})",
            item["latestVersion"].as_str().unwrap_or("latest")
        ),
        None => String::new(),
    }
}

fn via(item: &Value) -> String {
    item["strategy"]
        .as_str()
        .map(|strategy| format!(" via {strategy}"))
        .unwrap_or_default()
}

fn render(outcome: &Outcome, human: &mut Human) {
    let Some(data) = &outcome.data else {
        if let Some(error) = &outcome.error {
            human.error_line(&error.message);
        }
        for warning in &outcome.warnings {
            human.warn_line(&warning.message);
        }
        return;
    };
    for warning in &outcome.warnings {
        human.warn_line(&warning.message);
    }
    let results = data["results"].as_array().cloned().unwrap_or_default();
    for item in &results {
        let display = item["displayName"].as_str().unwrap_or_default();
        match item["status"].as_str().unwrap_or_default() {
            "up-to-date" => {
                let text = human.green(&format!(
                    "{display} is up to date ({})",
                    item["installedVersion"].as_str().unwrap_or("unknown")
                ));
                human.line(&text);
            }
            "manual-required" => {
                let text = human.yellow(&format!("{display}: manual action required."));
                human.warn_line(&text);
                if let Some(message) = item["message"].as_str() {
                    let text = human.cyan(&format!("Next step: {message}"));
                    human.warn_line(&text);
                }
            }
            "planned" => {
                let text = human.cyan(&format!("Would update {display}{}{}", via(item), version_hint(item)));
                human.line(&text);
            }
            "updated" => {
                let text = human.green(&format!("{display} updated successfully{}", version_hint(item)));
                human.line(&text);
            }
            "failed" => {
                let message = match item["message"].as_str() {
                    Some(reason) if !reason.trim().is_empty() => {
                        format!("Failed to update {display}: {}", reason.trim())
                    }
                    _ => format!("Failed to update {display}."),
                };
                let text = human.red(&message);
                human.error_line(&text);
                if let Some(hint) = item["hint"].as_str() {
                    let text = human.cyan(&format!("Next step: {hint}"));
                    human.warn_line(&text);
                }
            }
            "locked" => {
                let message = item["message"]
                    .as_str()
                    .map(str::to_owned)
                    .unwrap_or_else(|| format!("Another quantex process is already updating {display}."));
                human.warn_line(&message);
            }
            _ => {}
        }
    }
    if results.len() > 1 {
        let mut parts = Vec::new();
        for (status, label) in [
            ("updated", "updated"),
            ("up-to-date", "up to date"),
            ("manual-required", "manual"),
            ("failed", "failed"),
            ("locked", "locked"),
            ("planned", "planned"),
        ] {
            let count = results.iter().filter(|item| item["status"] == status).count();
            if count > 0 {
                parts.push(format!("{label} {count}"));
            }
        }
        if !parts.is_empty() {
            let text = human.bold(&format!("Summary: {}", parts.join(", ")));
            human.line(&text);
        }
    }
    if results.is_empty()
        && let Some(error) = &outcome.error
    {
        human.error_line(&error.message);
    }
}
