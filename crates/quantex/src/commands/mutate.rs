//! `install` and `ensure`.

use serde_json::{Map, Value, json};

use crate::catalog::{self, Agent};
use crate::context::Context;
use crate::lifecycle::{self, Decision, Kind, View};
use crate::protocol::{self, CommandError, ErrorCode, EventType, Outcome, Target, Warning};
use crate::providers::{self, Binding, Observed};
use crate::store::{self, InstalledAgent};
use crate::term::Human;

const LIFECYCLE_LOCK: &str = "agent lifecycle";

fn data(agent_name: &str, display_name: &str, changed: bool, installed: bool, state: Option<&InstalledAgent>) -> Value {
    let mut map = Map::new();
    map.insert(
        "agent".into(),
        json!({ "displayName": display_name, "name": agent_name }),
    );
    map.insert("changed".into(), changed.into());
    if let Some(state) = state {
        let mut install_state = Map::new();
        install_state.insert("installType".into(), state.install_type.as_str().into());
        if let Some(package) = &state.package_name {
            install_state.insert("packageName".into(), package.clone().into());
        }
        map.insert("installState".into(), Value::Object(install_state));
    }
    map.insert("installed".into(), installed.into());
    Value::Object(map)
}

fn agent_data(agent: &Agent, changed: bool, installed: bool, state: Option<&InstalledAgent>) -> Value {
    data(&agent.name, &agent.display_name, changed, installed, state)
}

fn success(operation: &str, agent: &Agent, value: Value) -> Outcome {
    Outcome::success(operation, Some(Target::agent(&agent.name)), value)
}

fn failure(operation: &str, agent: &Agent, error: CommandError) -> Outcome {
    Outcome::failure(operation, Some(Target::agent(&agent.name)), error)
        .with_data(agent_data(agent, false, false, None))
}

fn details(lifecycle: Option<&str>, reason: &str, remediation: Option<&str>) -> Option<Value> {
    let mut map = Map::new();
    if let Some(lifecycle) = lifecycle {
        map.insert("lifecycle".into(), lifecycle.into());
    }
    if !reason.trim().is_empty() {
        map.insert("reason".into(), reason.trim().into());
    }
    if let Some(remediation) = remediation {
        map.insert("remediation".into(), remediation.into());
    }
    (!map.is_empty()).then_some(Value::Object(map))
}

fn with_reason(message: &str, reason: &str) -> String {
    let reason = reason.trim();
    if reason.is_empty() {
        message.to_owned()
    } else {
        format!("{}: {reason}", message.trim_end_matches('.'))
    }
}

fn error(code: ErrorCode, message: String, details: Option<Value>) -> CommandError {
    let mut error = CommandError::new(code, message);
    error.details = details;
    error
}

fn already_installed(operation: &str, agent: &Agent) -> Outcome {
    success(operation, agent, agent_data(agent, false, true, None)).with_warning(Warning::new(
        "ALREADY_INSTALLED",
        format!("{} is already installed.", agent.display_name),
    ))
}

fn untracked(operation: &str, agent: &Agent) -> Outcome {
    success(operation, agent, agent_data(agent, false, true, None)).with_warning(Warning::new(
        "UNTRACKED_EXISTING_INSTALL",
        format!(
            "{} is already installed but not tracked by Quantex. Quantex could not safely determine the supported install source, so the existing install remains unmanaged.",
            agent.display_name
        ),
    ))
}

fn dry_run(operation: &str, agent: &Agent, route: &str) -> Outcome {
    let message = match route {
        "adopt" => format!(
            "Dry run: would record the existing {} install in Quantex state.",
            agent.display_name
        ),
        "reinstall" => format!(
            "Dry run: would reinstall {} only if its recorded provider target is confirmed absent.",
            agent.display_name
        ),
        _ => format!("Dry run: would install {}.", agent.display_name),
    };
    success(operation, agent, agent_data(agent, false, route == "adopt", None))
        .with_warning(Warning::new("DRY_RUN", message))
}

fn verification_failed(operation: &str, agent: &Agent, reason: &str) -> Outcome {
    let message = if operation == "ensure" {
        format!("{} could not be verified after ensure completed.", agent.display_name)
    } else {
        format!("{} could not be verified after installation.", agent.display_name)
    };
    failure(
        operation,
        agent,
        error(
            ErrorCode::InstallFailed,
            message,
            details(Some("verification-failed"), reason, None),
        ),
    )
}

fn install_failed(operation: &str, agent: &Agent, reason: &str, remediation: Option<&str>) -> Outcome {
    let lifecycle = reason
        .trim_start()
        .starts_with("No installation provider is currently available")
        .then_some("provider-unavailable");
    failure(
        operation,
        agent,
        error(
            ErrorCode::InstallFailed,
            with_reason(&format!("Failed to install {}.", agent.display_name), reason),
            details(lifecycle, reason, remediation),
        ),
    )
}

/// The catalog source an untracked executable can be adopted as, if any.
fn adoptable(view: &View) -> Option<(crate::catalog::InstallMethod, Binding)> {
    let method = providers::adoptable_method(&view.methods, view.path_executable.path.as_deref())?;
    let binding = Binding::from_method(view.agent, &method)?;
    Some((method, binding))
}

/// v1 `invalidAdoptionReason`: adoption must keep the source the observation found.
fn invalid_adoption(view: &View, method: &crate::catalog::InstallMethod, binding: &Binding) -> Option<&'static str> {
    if view.kind != Kind::Present || view.drift != lifecycle::Drift::Untracked {
        return Some("Compatibility adoption requires a fresh untracked present observation.");
    }
    let exe = view.agent.binary_name.as_str();
    let exact = |left: &Binding, right: &Binding| {
        left.same_source(right, exe) && left.target.arguments == right.target.arguments
    };
    if let Some(observed) = &view.binding
        && !exact(observed, binding)
    {
        return Some("Compatibility adoption does not preserve the observed provider source.");
    }
    let state = providers::installed_state_for_method(view.agent, method, true);
    match Binding::from_installed(view.agent, &state) {
        Some(state_binding) if exact(&state_binding, binding) => None,
        _ => Some("Compatibility adoption state does not resolve to the selected provider source."),
    }
}

fn blocked(operation: &str, agent: &Agent, reason: &str) -> Outcome {
    failure(
        operation,
        agent,
        error(
            ErrorCode::InstallFailed,
            with_reason(
                &format!(
                    "Quantex could not determine the installed state of {}.",
                    agent.display_name
                ),
                reason,
            ),
            details(Some("decision-indeterminate"), reason, None),
        ),
    )
}

fn record(ctx: &Context, view: &View, installed: &InstalledAgent, binding: &Binding) -> Result<(), CommandError> {
    let receipt = lifecycle::receipt(view, binding);
    let name = view.agent.name.clone();
    store::mutate_state(&ctx.quantex_dir(), |state| {
        state.installed_agents.insert(name.clone(), installed.clone());
        state.lifecycle_receipts.insert(name.clone(), receipt.clone());
    })
    .map(|_| ())
    .map_err(store::MutateError::into_command_error)
}

/// Installs or ensures one agent and returns its outcome without emitting it.
pub fn install_agent(ctx: &Context, input: &str, operation: &str, emit_started: bool) -> Outcome {
    let dir = ctx.quantex_dir();
    let Some(agent) = catalog::find(input) else {
        return Outcome::failure(
            operation,
            Some(Target::agent(input)),
            CommandError::new(ErrorCode::AgentNotFound, format!("Unknown agent: {input}"))
                .details(json!({ "input": input })),
        );
    };
    let state = match store::load_state(&dir) {
        Ok(state) => state,
        Err(error) => return Outcome::failure(operation, Some(Target::agent(input)), error.into_command_error()),
    };

    // An unattributable executable outside Quantex stays as it is, without taking the lock.
    let unmanaged_candidate = !state.installed_agents.contains_key(&agent.name)
        && !state.lifecycle_receipts.contains_key(&agent.name)
        && crate::probe::resolve_executable(std::slice::from_ref(&agent.binary_name)).is_some();
    if unmanaged_candidate {
        let view_methods = observe_methods(ctx, agent);
        let path = crate::probe::resolve_executable(&crate::probe::lookup_names(agent))
            .map(|path| crate::probe::real_path(&path));
        if providers::adoptable_method(&view_methods, path.as_deref()).is_none() {
            return untracked(operation, agent);
        }
    }

    if ctx.dry_run {
        let view = lifecycle::observe_lifecycle(ctx, agent, &state, None);
        return preview(operation, &view);
    }

    let _lock = match store::acquire_lock(&dir, LIFECYCLE_LOCK, &["agent-lifecycle"]) {
        Ok(lock) => lock,
        Err(error) => return Outcome::failure(operation, Some(Target::agent(input)), error.into_command_error()),
    };
    let view = lifecycle::observe_lifecycle(ctx, agent, &state, None);
    let decision = lifecycle::decide(&view);
    match decision {
        Decision::Interrupted => install_failed(operation, agent, "", None),
        Decision::Blocked(reason) => blocked(operation, agent, &reason),
        Decision::AlreadySatisfied => already_installed(operation, agent),
        Decision::ExternalPreserved => match adoptable(&view) {
            None => untracked(operation, agent),
            Some((method, binding)) if invalid_adoption(&view, &method, &binding).is_some() => blocked(
                operation,
                agent,
                invalid_adoption(&view, &method, &binding).unwrap_or_default(),
            ),
            Some((method, binding)) => {
                let installed = providers::installed_state_for_method(agent, &method, true);
                if let Err(error) = record(ctx, &view, &installed, &binding) {
                    return Outcome::failure(operation, Some(Target::agent(&agent.name)), error);
                }
                success(operation, agent, agent_data(agent, true, true, Some(&installed))).with_warning(Warning::new(
                    "TRACKED_EXISTING_INSTALL",
                    format!(
                        "{} is already installed. Quantex is now tracking the existing install.",
                        agent.display_name
                    ),
                ))
            }
        },
        Decision::Install | Decision::Reinstall(_) => apply_install(ctx, operation, &view, &decision, emit_started),
    }
}

fn observe_methods(ctx: &Context, agent: &Agent) -> Vec<crate::catalog::InstallMethod> {
    crate::observe::ordered_methods(ctx, agent)
}

fn preview(operation: &str, view: &View) -> Outcome {
    let agent = view.agent;
    match lifecycle::decide(view) {
        Decision::AlreadySatisfied => already_installed(operation, agent),
        Decision::ExternalPreserved => match adoptable(view) {
            None => untracked(operation, agent),
            Some((method, binding)) => match invalid_adoption(view, &method, &binding) {
                Some(reason) => blocked(operation, agent, reason),
                None => dry_run(operation, agent, "adopt"),
            },
        },
        Decision::Install => dry_run(operation, agent, "install"),
        Decision::Reinstall(_) => dry_run(operation, agent, "reinstall"),
        Decision::Blocked(_) | Decision::Interrupted => {
            let in_path = view.path_executable.present;
            match (&view.installed, in_path) {
                (None, true) => {
                    if adoptable(view).is_some() {
                        dry_run(operation, agent, "adopt")
                    } else {
                        untracked(operation, agent)
                    }
                }
                (Some(_), true) => already_installed(operation, agent),
                (Some(_), false) => dry_run(operation, agent, "reinstall"),
                (None, false) => dry_run(operation, agent, "install"),
            }
        }
    }
}

fn apply_install(ctx: &Context, operation: &str, view: &View, decision: &Decision, emit_started: bool) -> Outcome {
    let agent = view.agent;
    let recipe = match lifecycle::resolve_recipe(ctx, view, decision) {
        Ok(recipe) => recipe,
        Err(reason) => return install_failed(operation, agent, &reason, None),
    };
    if emit_started {
        protocol::emit_event(
            ctx,
            operation,
            EventType::Started,
            json!({ "agent": { "displayName": agent.display_name, "name": agent.name } }),
            Some(&Target::agent(&agent.name)),
        );
    }
    let command = providers::install_command(&recipe.binding, agent);
    let description = match recipe.binding.provider {
        crate::catalog::Provider::Script | crate::catalog::Provider::Binary => "install effect failed".to_owned(),
        provider => format!("{} install failed", provider.as_str()),
    };
    let remediation = (!recipe.binding.provider.is_managed())
        .then_some("Review the installer output and upstream installation instructions.");
    if let Err(failure) = providers::run_mutation(ctx, &command, &description) {
        return install_failed(operation, agent, &failure.reason(), remediation);
    }
    if recipe.binding.provider == crate::catalog::Provider::Bun
        && let Err(failure) = providers::trust_bun_packages(ctx, std::slice::from_ref(&recipe.binding.target.id))
    {
        compensate(ctx, &recipe.binding);
        return install_failed(operation, agent, &failure.reason(), None);
    }
    match providers::observe(ctx, &recipe.binding) {
        Observed::Present { .. } => {}
        Observed::Absent => {
            compensate(ctx, &recipe.binding);
            return verification_failed(
                operation,
                agent,
                &format!(
                    "{} is not installed through {}",
                    recipe.binding.target.id,
                    recipe.binding.provider.as_str()
                ),
            );
        }
        other => {
            compensate(ctx, &recipe.binding);
            return verification_failed(operation, agent, &other.reason());
        }
    }
    let state = store::load_state(&ctx.quantex_dir()).unwrap_or_default();
    let verified = lifecycle::observe_lifecycle(ctx, agent, &state, Some(&recipe.binding));
    if verified.kind != Kind::Present {
        compensate(ctx, &recipe.binding);
        return verification_failed(
            operation,
            agent,
            "Fresh post-mutation observation did not confirm the selected provider source.",
        );
    }
    if let Err(error) = record(ctx, &verified, &recipe.installed, &recipe.binding) {
        return failure(
            operation,
            agent,
            self::error(
                ErrorCode::InstallFailed,
                format!("Failed to record verified state for {}.", agent.display_name),
                details(Some("state-write-failed"), &error.message, None),
            ),
        );
    }
    success(operation, agent, agent_data(agent, true, true, Some(&recipe.installed)))
}

/// Removes what a failed install just added, for package managers that can.
fn compensate(ctx: &Context, binding: &Binding) {
    if let Some(command) = providers::uninstall_command(binding) {
        let _ = providers::run_mutation(ctx, &command, "compensating uninstall failed");
    }
}

// ---------------------------------------------------------------------------
// Commands

pub fn render_single(outcome: &Outcome, human: &mut Human) {
    if let Some(error) = &outcome.error {
        human.error_line(&error.message);
        return;
    }
    let Some(data) = &outcome.data else { return };
    if !outcome.warnings.is_empty() {
        for warning in &outcome.warnings {
            match warning.code.as_str() {
                "TRACKED_EXISTING_INSTALL" => {
                    let text = human.green(&warning.message);
                    human.line(&text);
                }
                "DRY_RUN" => {
                    let text = human.cyan(&warning.message);
                    human.line(&text);
                }
                _ => human.warn_line(&warning.message),
            }
        }
        return;
    }
    let name = data["agent"]["displayName"].as_str().unwrap_or_default();
    let text = human.green(&format!("{name} installed successfully!"));
    human.line(&text);
}

pub fn ensure(ctx: &Context, input: &str) -> Outcome {
    install_agent(ctx, input, "ensure", true).with_human(render_single)
}

/// Canonical batch targets: catalog names where known, deduplicated, sorted.
pub fn normalize_targets(inputs: &[String]) -> Vec<String> {
    let mut targets: Vec<String> = inputs
        .iter()
        .map(|input| catalog::find(input).map_or_else(|| input.clone(), |agent| agent.name.clone()))
        .collect();
    targets.sort();
    targets.dedup();
    targets
}

fn batch_status(outcome: &Outcome) -> &'static str {
    if !outcome.ok {
        return if outcome
            .error
            .as_ref()
            .is_some_and(|error| error.code == ErrorCode::ResourceLocked)
        {
            "locked"
        } else {
            "failed"
        };
    }
    let has = |code: &str| outcome.warnings.iter().any(|warning| warning.code == code);
    if has("TRACKED_EXISTING_INSTALL") {
        "tracked-existing-install"
    } else if has("UNTRACKED_EXISTING_INSTALL") {
        "untracked-existing-install"
    } else if has("ALREADY_INSTALLED") {
        "already-installed"
    } else if has("DRY_RUN") {
        "planned"
    } else {
        "installed"
    }
}

fn batch_item(input: &str, outcome: &Outcome) -> Value {
    let data = outcome.data.clone().unwrap_or_else(|| {
        let name = outcome
            .target
            .as_ref()
            .and_then(|target| target.name.clone())
            .unwrap_or_else(|| input.to_owned());
        data(&name, input, false, false, None)
    });
    let mut map = data.as_object().cloned().unwrap_or_default();
    if let Some(error) = &outcome.error {
        map.insert(
            "error".into(),
            json!({ "code": error.code.as_str(), "message": error.message }),
        );
    }
    map.insert("input".into(), input.into());
    map.insert("ok".into(), outcome.ok.into());
    map.insert("status".into(), batch_status(outcome).into());
    map.insert(
        "warnings".into(),
        Value::Array(
            outcome
                .warnings
                .iter()
                .map(|warning| json!({ "code": warning.code, "message": warning.message }))
                .collect(),
        ),
    );
    Value::Object(map)
}

pub fn install(ctx: &Context, inputs: &[String]) -> Outcome {
    let targets = normalize_targets(inputs);
    if targets.len() <= 1 {
        let input = targets.first().cloned().unwrap_or_default();
        return install_agent(ctx, &input, "install", true).with_human(render_single);
    }
    protocol::emit_event(
        ctx,
        "install",
        EventType::Started,
        json!({ "scope": "batch" }),
        Some(&Target::new(crate::protocol::TargetKind::Agent, None::<String>)),
    );
    let mut results = Vec::new();
    for input in &targets {
        if ctx.is_cancelled() {
            break;
        }
        let outcome = install_agent(ctx, input, "install", false);
        let item = batch_item(input, &outcome);
        protocol::emit_event(
            ctx,
            "install",
            EventType::Progress,
            item.clone(),
            Some(&Target::agent(item["agent"]["name"].as_str().unwrap_or(input))),
        );
        results.push(item);
    }
    let mut summary = json!({
        "alreadyInstalled": 0, "failed": 0, "installed": 0, "locked": 0,
        "planned": 0, "trackedExistingInstall": 0, "untrackedExistingInstall": 0,
    });
    for result in &results {
        let key = match result["status"].as_str().unwrap_or_default() {
            "already-installed" => "alreadyInstalled",
            "failed" => "failed",
            "locked" => "locked",
            "planned" => "planned",
            "tracked-existing-install" => "trackedExistingInstall",
            "untracked-existing-install" => "untrackedExistingInstall",
            _ => "installed",
        };
        summary[key] = (summary[key].as_u64().unwrap_or(0) + 1).into();
    }
    let data = json!({ "results": results, "scope": "batch", "summary": summary });
    let target = Some(Target::new(crate::protocol::TargetKind::Agent, None::<String>));
    let failures: Vec<&Value> = results.iter().filter(|result| result["ok"] == false).collect();
    if failures.is_empty() {
        return Outcome::success("install", target, data).with_human(render_batch);
    }
    let failed_agents: Vec<Value> = failures.iter().map(|result| result["input"].clone()).collect();
    let only_locked = failures
        .iter()
        .all(|result| result["error"]["code"] == "RESOURCE_LOCKED");
    let error = if only_locked {
        CommandError::new(
            ErrorCode::ResourceLocked,
            "One or more agents could not be installed because another Quantex process is already using the agent lifecycle lock.",
        )
    } else {
        CommandError::new(ErrorCode::InstallFailed, "One or more agents failed to install.")
    }
    .details(json!({ "failedAgents": failed_agents }));
    Outcome::failure("install", target, error)
        .with_data(data)
        .with_human(render_batch)
}

fn render_batch(outcome: &Outcome, human: &mut Human) {
    let Some(data) = &outcome.data else {
        if let Some(error) = &outcome.error {
            human.error_line(&error.message);
        }
        return;
    };
    for result in data["results"].as_array().into_iter().flatten() {
        let name = result["agent"]["displayName"].as_str().unwrap_or_default();
        let status = result["status"].as_str().unwrap_or_default();
        let line = match status {
            "installed" => human.green(&format!("✓ {name} installed")),
            "failed" | "locked" => human.red(&format!(
                "✗ {name}: {}",
                result["error"]["message"].as_str().unwrap_or(status)
            )),
            other => format!("• {name}: {other}"),
        };
        human.line(&line);
    }
    if let Some(error) = &outcome.error {
        human.error_line(&error.message);
    }
}
