//! `update`: one agent, `--all`, or `--all --managed`.
//!
//! Each target is observed, planned against its confirmed recorded source, executed
//! under the lifecycle lock, and verified by a fresh observation.

use serde_json::{Map, Value, json};

use crate::catalog::{self, Agent, Provider};
use crate::context::Context;
use crate::lifecycle::{self, Status, View};
use crate::observe::{self, UpdateStrategy};
use crate::protocol::{CommandError, ErrorCode, Outcome, Target, TargetKind, Warning};
use crate::providers::{self, Binding, MutationFailure};
use crate::store::{self, State};
use crate::term::Human;
use crate::{net, probe};

const LIFECYCLE_LOCK: &str = "agent lifecycle";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Blocked {
    NotInstalled,
    StaleState,
    Untracked,
    UnknownSource,
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

/// What a confirmed npm or bun source's latest version means for the install.
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
    /// The version a fresh observation found after the update.
    Updated {
        version: Option<String>,
    },
    UpToDate {
        version: Option<String>,
    },
    ProviderFailed,
    TimedOut,
    Cancelled,
    Unsatisfied(String),
    Locked {
        message: String,
        resource: String,
    },
}

// ---------------------------------------------------------------------------
// Planning

fn tracked_unmanaged(view: &View) -> bool {
    view.installed
        .as_ref()
        .is_some_and(|installed| installed.install_type == Provider::Script)
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
    let before = lifecycle::observe_lifecycle(ctx, agent, state);
    if ctx.is_cancelled() {
        return Planning::Cancelled { before };
    }
    let blocked = |before: View, category: Blocked, reason: String| Planning::Blocked {
        before,
        category,
        reason,
    };
    let binding = match &before.status {
        Status::Managed => before.binding.clone().expect("a managed agent has a recorded source"),
        Status::Absent => return blocked(before, Blocked::NotInstalled, String::new()),
        Status::Stale => {
            let reason = format!(
                "{} has a stale record. Run `quantex uninstall {}` to reconcile it.",
                agent.display_name, agent.name
            );
            return blocked(before, Blocked::StaleState, reason);
        }
        Status::Untracked => return blocked(before, Blocked::Untracked, String::new()),
        Status::Unknown(reason) => {
            let reason = reason.clone();
            return blocked(before, Blocked::UnknownSource, reason);
        }
        Status::TimedOut => return Planning::TimedOut { before },
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
    let target = plan.latest_version().unwrap_or_else(|| "latest".into());
    let versions = plan
        .before
        .executable
        .version
        .as_deref()
        .map(|installed| format!(" ({installed} -> {target})"))
        .unwrap_or_default();
    crate::term::progress(
        ctx,
        &format!(
            "Updating {} via {}...{versions}",
            agent.display_name,
            plan.strategy_label()
        ),
    );
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
    let after = lifecycle::observe_lifecycle(ctx, agent, &state);
    if ctx.is_cancelled() {
        return Execution::Cancelled;
    }
    let version = after.executable.version.clone();
    match verify(plan, &after) {
        Ok(true) => Execution::Updated { version },
        Ok(false) => Execution::UpToDate { version },
        Err(reason) => Execution::Unsatisfied(reason),
    }
}

fn run_provider_update(ctx: &Context, binding: &Binding) -> Result<(), MutationFailure> {
    let Some(command) = providers::update_command(binding) else {
        return Err(MutationFailure::Failed(format!(
            "Provider {} does not support update.",
            binding.provider.as_str()
        )));
    };
    providers::run_collapsed_mutation(ctx, &command, &format!("{} update failed", binding.provider.as_str()))?;
    if binding.provider == Provider::Bun {
        providers::trust_bun_packages(ctx, std::slice::from_ref(&binding.target.id))?;
    }
    Ok(())
}

/// Runs the agent's own update commands; the first that succeeds wins.
fn run_self_update(ctx: &Context, commands: &[Vec<String>]) -> Result<(), MutationFailure> {
    let mut last = MutationFailure::Failed("No self-update command is configured.".into());
    for command in commands {
        match providers::run_collapsed_mutation(ctx, command, "agent self-update failed") {
            Ok(()) => return Ok(()),
            Err(failure @ (MutationFailure::TimedOut | MutationFailure::Cancelled)) => return Err(failure),
            Err(failure) => last = failure,
        }
    }
    Err(last)
}

/// Whether the update reached its target. Returns whether the version moved.
fn verify(plan: &Plan, after: &View) -> Result<bool, String> {
    if after.status != Status::Managed {
        return Err(format!(
            "{} is no longer present through its recorded source after the update.",
            after.agent.display_name
        ));
    }
    let version = after.executable.version.as_deref();
    match &plan.strategy {
        Strategy::Managed { target_version } => {
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

fn installed_version(view: &View) -> Option<String> {
    view.present().then(|| view.executable.version.clone()).flatten()
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

/// One `results` entry.
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
                    Blocked::NotInstalled | Blocked::StaleState | Blocked::UnknownSource => ("failed", reason.clone()),
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
        Execution::Updated { version } => Item::new(display, name, "updated")
            .set("installedVersion", installed.clone())
            .set("latestVersion", version.clone().or(latest.clone()))
            .set("strategy", strategy),
        Execution::UpToDate { version } => Item::new(display, name, "up-to-date")
            .set("installedVersion", version.clone().or(installed.clone()))
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
        Execution::Unsatisfied(reason) => base("failed")
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
            "{} is not installed but has a stale record. Run `quantex uninstall {}` to reconcile it.",
            agent.display_name, agent.name
        ),
    )
    .details(json!({
        "agentName": agent.name,
        "suggestedAction": "reconcile-agent-state",
        "suggestedCommands": [format!("quantex uninstall {}", agent.name)],
    }))
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
        && matches!(before.status, Status::Absent | Status::Stale)
    {
        let outcome = Outcome::failure(
            "update",
            Some(target),
            CommandError::new(
                ErrorCode::AgentNotInstalled,
                format!("{} is not installed.", agent.display_name),
            ),
        );
        return if before.status == Status::Stale {
            outcome.with_warning(stale_state_warning(agent))
        } else {
            outcome
        };
    }
    let item = result_item(ctx, agent, planning, execution);
    let status = item.status().to_owned();
    let results = vec![item.into_value()];
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

/// A catalog agent with nothing on disk and no record.
fn catalog_only_absent(planning: &Planning) -> bool {
    planning.before().is_some_and(|before| before.status == Status::Absent)
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
    crate::term::progress(ctx, "Checking installed agents...");
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
        results.push(Item::new(name, name, "failed").into_value());
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
            results.push(item.into_value());
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
    results.push(item.into_value());
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
    if results.is_empty() && outcome.error.is_none() {
        let text = human.dim(if data["scope"] == "managed" {
            "No managed agents are installed."
        } else {
            "No installed agents to update."
        });
        human.line(&text);
    }
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
