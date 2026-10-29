//! `install` (and its alias `ensure`) and `uninstall`.

use serde_json::{Map, Value, json};

use crate::catalog::{self, Agent};
use crate::context::Context;
use crate::lifecycle::{self, Decision, View};
use crate::protocol::{CommandError, ErrorCode, Outcome, Target, Warning};
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

fn success(agent: &Agent, value: Value) -> Outcome {
    Outcome::success("install", Some(Target::agent(&agent.name)), value)
}

fn failure(agent: &Agent, error: CommandError) -> Outcome {
    Outcome::failure("install", Some(Target::agent(&agent.name)), error)
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

fn already_installed(agent: &Agent) -> Outcome {
    success(agent, agent_data(agent, false, true, None)).with_warning(Warning::new(
        "ALREADY_INSTALLED",
        format!("{} is already installed.", agent.display_name),
    ))
}

fn untracked(agent: &Agent) -> Outcome {
    success(agent, agent_data(agent, false, true, None)).with_warning(Warning::new(
        "UNTRACKED_EXISTING_INSTALL",
        format!(
            "{} is already installed but not tracked by Quantex. Quantex could not safely determine the supported install source, so the existing install remains unmanaged.",
            agent.display_name
        ),
    ))
}

fn dry_run(agent: &Agent, route: &str) -> Outcome {
    let message = match route {
        "adopt" => format!(
            "Dry run: would record the existing {} install in Quantex state.",
            agent.display_name
        ),
        _ => format!("Dry run: would install {}.", agent.display_name),
    };
    success(agent, agent_data(agent, false, route == "adopt", None)).with_warning(Warning::new("DRY_RUN", message))
}

fn verification_failed(agent: &Agent, reason: &str) -> Outcome {
    let message = format!("{} could not be verified after installation.", agent.display_name);
    failure(
        agent,
        error(
            ErrorCode::InstallFailed,
            message,
            details(Some("verification-failed"), reason, None),
        ),
    )
}

fn install_failed(agent: &Agent, reason: &str, remediation: Option<&str>) -> Outcome {
    let lifecycle = reason
        .trim_start()
        .starts_with("No installation provider is currently available")
        .then_some("provider-unavailable");
    failure(
        agent,
        error(
            ErrorCode::InstallFailed,
            with_reason(&format!("Failed to install {}.", agent.display_name), reason),
            details(lifecycle, reason, remediation),
        ),
    )
}

fn blocked(agent: &Agent, reason: &str) -> Outcome {
    failure(
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

fn record(ctx: &Context, agent: &Agent, installed: &InstalledAgent) -> Result<(), CommandError> {
    let name = agent.name.clone();
    store::mutate_state(&ctx.quantex_dir(), |state| {
        state.installed_agents.insert(name.clone(), installed.clone());
    })
    .map(|_| ())
    .map_err(store::MutateError::into_command_error)
}

/// Installs one agent and returns its outcome without emitting it.
pub fn install_agent(ctx: &Context, input: &str) -> Outcome {
    let dir = ctx.quantex_dir();
    let Some(agent) = catalog::find(input) else {
        return Outcome::failure(
            "install",
            Some(Target::agent(input)),
            CommandError::new(ErrorCode::AgentNotFound, format!("Unknown agent: {input}"))
                .details(json!({ "input": input })),
        );
    };
    let _lock = if ctx.dry_run {
        None
    } else {
        match store::acquire_lock(&dir, LIFECYCLE_LOCK, &["agent-lifecycle"]) {
            Ok(lock) => Some(lock),
            Err(error) => return Outcome::failure("install", Some(Target::agent(input)), error.into_command_error()),
        }
    };
    let state = match store::load_state(&dir) {
        Ok(state) => state,
        Err(error) => return Outcome::failure("install", Some(Target::agent(input)), error.into_command_error()),
    };
    let view = lifecycle::observe_lifecycle(ctx, agent, &state);
    match lifecycle::decide(&view) {
        Decision::Interrupted => install_failed(agent, "", None),
        Decision::Blocked(reason) => blocked(agent, &reason),
        Decision::AlreadySatisfied => already_installed(agent),
        Decision::Adopt => adopt(ctx, &view),
        Decision::Install if ctx.dry_run => dry_run(agent, "install"),
        Decision::Install => apply_install(ctx, &view),
    }
}

/// Records an untracked executable when its path or the catalog makes its source clear
/// and that source confirms it; anything else stays as it is.
fn adopt(ctx: &Context, view: &View) -> Outcome {
    let agent = view.agent;
    let Some(method) = providers::adoptable_method(&view.methods, view.executable.path.as_deref()) else {
        return untracked(agent);
    };
    let confirmed = Binding::from_method(agent, &method)
        .is_some_and(|binding| matches!(providers::observe(ctx, &binding), Observed::Present { .. }));
    if !confirmed {
        return untracked(agent);
    }
    if ctx.dry_run {
        return dry_run(agent, "adopt");
    }
    let installed = providers::installed_state_for_method(agent, &method);
    if let Err(error) = record(ctx, agent, &installed) {
        return Outcome::failure("install", Some(Target::agent(&agent.name)), error);
    }
    success(agent, agent_data(agent, true, true, Some(&installed))).with_warning(Warning::new(
        "TRACKED_EXISTING_INSTALL",
        format!(
            "{} is already installed. Quantex is now tracking the existing install.",
            agent.display_name
        ),
    ))
}

fn apply_install(ctx: &Context, view: &View) -> Outcome {
    let agent = view.agent;
    let recipe = match lifecycle::resolve_recipe(ctx, view) {
        Ok(recipe) => recipe,
        Err(reason) => return install_failed(agent, &reason, None),
    };
    let command = providers::install_command(&recipe.binding, agent);
    let description = match recipe.binding.provider {
        crate::catalog::Provider::Script => "install effect failed".to_owned(),
        provider => format!("{} install failed", provider.as_str()),
    };
    let remediation = (!recipe.binding.provider.is_managed())
        .then_some("Review the installer output and upstream installation instructions.");
    crate::term::progress(
        ctx,
        &format!(
            "Installing {} via {}...",
            agent.display_name,
            recipe.binding.provider.as_str()
        ),
    );
    if let Err(failure) = providers::run_mutation(ctx, &command, &description) {
        return install_failed(agent, &failure.reason(), remediation);
    }
    if recipe.binding.provider == crate::catalog::Provider::Bun
        && let Err(failure) = providers::trust_bun_packages(ctx, std::slice::from_ref(&recipe.binding.target.id))
    {
        compensate(ctx, &recipe.binding);
        return install_failed(agent, &failure.reason(), None);
    }
    let reason = match providers::observe(ctx, &recipe.binding) {
        Observed::Present { .. } => None,
        Observed::Absent => Some(format!(
            "{} is not installed through {}",
            recipe.binding.target.id,
            recipe.binding.provider.as_str()
        )),
        other => Some(other.reason()),
    };
    if let Some(reason) = reason {
        compensate(ctx, &recipe.binding);
        return verification_failed(agent, &reason);
    }
    if let Err(error) = record(ctx, agent, &recipe.installed) {
        return failure(
            agent,
            self::error(
                ErrorCode::InstallFailed,
                format!("Failed to record verified state for {}.", agent.display_name),
                details(Some("state-write-failed"), &error.message, None),
            ),
        );
    }
    success(agent, agent_data(agent, true, true, Some(&recipe.installed)))
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
        return install_agent(ctx, &input).with_human(render_single);
    }
    let mut results = Vec::new();
    for input in &targets {
        if ctx.is_cancelled() {
            break;
        }
        let outcome = install_agent(ctx, input);
        let item = batch_item(input, &outcome);
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

// ---------------------------------------------------------------------------
// uninstall

fn uninstall_data(agent: &Agent, changed: bool) -> Value {
    json!({ "agent": { "displayName": agent.display_name, "name": agent.name }, "changed": changed })
}

fn uninstall_failed(agent: &Agent, lifecycle: &str, message: String) -> Outcome {
    Outcome::failure(
        "uninstall",
        Some(Target::agent(&agent.name)),
        CommandError::new(ErrorCode::UninstallFailed, message).details(json!({ "lifecycle": lifecycle })),
    )
    .with_data(uninstall_data(agent, false))
}

fn uninstall_done(agent: &Agent, changed: bool, warning: Option<Warning>) -> Outcome {
    let mut outcome = Outcome::success(
        "uninstall",
        Some(Target::agent(&agent.name)),
        uninstall_data(agent, changed),
    );
    if let Some(warning) = warning {
        outcome = outcome.with_warning(warning);
    }
    outcome.with_human(render_uninstall)
}

fn binary_present(agent: &Agent) -> bool {
    crate::probe::resolve_executable(std::slice::from_ref(&agent.binary_name)).is_some()
}

pub fn uninstall(ctx: &Context, input: &str) -> Outcome {
    let dir = ctx.quantex_dir();
    let Some(agent) = catalog::find(input) else {
        return Outcome::failure(
            "uninstall",
            Some(Target::agent(input)),
            CommandError::new(ErrorCode::AgentNotFound, format!("Unknown agent: {input}"))
                .details(json!({ "input": input })),
        )
        .with_human(render_uninstall);
    };
    let _lock = match store::acquire_lock(&dir, LIFECYCLE_LOCK, &["agent-lifecycle"]) {
        Ok(lock) => lock,
        Err(error) => {
            return Outcome::failure(
                "uninstall",
                Some(Target::agent(&agent.name)),
                error.into_command_error(),
            )
            .with_data(uninstall_data(agent, false))
            .with_human(render_uninstall);
        }
    };
    let state = match store::load_state(&dir) {
        Ok(state) => state,
        Err(error) => {
            return Outcome::failure("uninstall", Some(Target::agent(input)), error.into_command_error())
                .with_human(render_uninstall);
        }
    };
    let Some(installed) = state.installed_agents.get(&agent.name).cloned() else {
        return Outcome::failure(
            "uninstall",
            Some(Target::agent(&agent.name)),
            CommandError::new(
                ErrorCode::UninstallUnmanaged,
                format!(
                    "{} is not managed by qtx, so qtx cannot auto-uninstall it. Run qtx inspect {} for details.",
                    agent.display_name, agent.name
                ),
            )
            .details(json!({
                "canAutoUninstall": false,
                "displayName": agent.display_name,
                "input": input,
                "lifecycle": "unmanaged",
                "name": agent.name,
            })),
        )
        .with_data(uninstall_data(agent, false))
        .with_human(render_uninstall);
    };
    uninstall_recorded(ctx, agent, &installed).with_human(render_uninstall)
}

fn uninstall_recorded(ctx: &Context, agent: &'static Agent, installed: &InstalledAgent) -> Outcome {
    let dir = ctx.quantex_dir();
    let Some(binding) = Binding::from_installed(agent, installed) else {
        return uninstall_failed(
            agent,
            "indeterminate-source",
            format!("Cannot resolve the recorded install source for {}.", agent.display_name),
        );
    };
    let name = agent.name.clone();
    let forget = |restore: Option<&InstalledAgent>| {
        store::mutate_state(&dir, |state| {
            match restore {
                Some(installed) => state.installed_agents.insert(name.clone(), installed.clone()),
                None => state.installed_agents.remove(&name),
            };
        })
        .map(|_| ())
        .map_err(store::MutateError::into_command_error)
    };
    match providers::observe(ctx, &binding) {
        Observed::Present { .. } => {}
        Observed::Absent if binary_present(agent) => {
            return uninstall_failed(
                agent,
                "conflicting-source",
                format!(
                    "{} is on PATH but its recorded provider target is absent.",
                    agent.display_name
                ),
            );
        }
        Observed::Absent if ctx.dry_run => {
            return uninstall_done(
                agent,
                false,
                Some(Warning::new("DRY_RUN", "Dry run: would remove the stale record.")),
            );
        }
        Observed::Absent => {
            if let Err(error) = forget(None) {
                return Outcome::failure("uninstall", Some(Target::agent(&agent.name)), error);
            }
            return uninstall_done(
                agent,
                true,
                Some(Warning::new(
                    "GHOST_STATE_RECONCILED",
                    format!(
                        "{} was already absent; its stale record was removed.",
                        agent.display_name
                    ),
                )),
            );
        }
        _ => {
            return uninstall_failed(
                agent,
                "indeterminate-source",
                format!("Cannot verify provider state for {}.", agent.display_name),
            );
        }
    }
    if ctx.dry_run {
        return uninstall_done(
            agent,
            false,
            Some(Warning::new(
                "DRY_RUN",
                format!("Dry run: would uninstall {}.", agent.display_name),
            )),
        );
    }
    // A script install has no uninstaller; only its record goes.
    let Some(command) = providers::uninstall_command(&binding) else {
        return match forget(None) {
            Ok(()) => uninstall_done(agent, true, None),
            Err(error) => Outcome::failure("uninstall", Some(Target::agent(&agent.name)), error),
        };
    };
    let description = format!("{} uninstall failed", binding.provider.as_str());
    crate::term::progress(
        ctx,
        &format!(
            "Uninstalling {} via {}...",
            agent.display_name,
            binding.provider.as_str()
        ),
    );
    if providers::run_mutation(ctx, &command, &description).is_err()
        && providers::observe(ctx, &binding) != Observed::Absent
    {
        return uninstall_failed(
            agent,
            "provider-failure",
            format!("Failed to uninstall {}.", agent.display_name),
        );
    }
    if let Err(error) = forget(None) {
        return Outcome::failure("uninstall", Some(Target::agent(&agent.name)), error);
    }
    let mut absent = false;
    for attempt in 0..6 {
        if ctx.is_cancelled() {
            break;
        }
        if providers::observe(ctx, &binding) == Observed::Absent && !binary_present(agent) {
            absent = true;
            break;
        }
        if attempt < 5 {
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    }
    if absent {
        return uninstall_done(agent, true, None);
    }
    if providers::observe(ctx, &binding) == Observed::Absent {
        return uninstall_failed(
            agent,
            "conflicting-source",
            format!(
                "{0}'s managed package was removed, but another copy remains on PATH. If Bun left {1}.exe and {1}.bunx in its global bin, delete that pair and retry.",
                agent.display_name, agent.binary_name
            ),
        );
    }
    let _ = forget(Some(installed));
    uninstall_failed(
        agent,
        "verification-failed",
        format!("{} is still present after provider removal.", agent.display_name),
    )
}

fn render_uninstall(outcome: &Outcome, human: &mut Human) {
    if let Some(error) = &outcome.error {
        human.error_line(&error.message);
        return;
    }
    let Some(data) = &outcome.data else { return };
    if !outcome.warnings.is_empty() {
        for warning in &outcome.warnings {
            human.warn_line(&warning.message);
        }
        return;
    }
    let name = data["agent"]["displayName"].as_str().unwrap_or_default();
    let text = human.green(&format!("{name} uninstalled successfully!"));
    human.line(&text);
}
