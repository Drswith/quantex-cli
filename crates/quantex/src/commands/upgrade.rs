//! `upgrade`: check for and install a newer Quantex CLI.

use serde_json::{Map, Value, json};

use crate::context::Context;
use crate::protocol::{CommandError, ErrorCode, Outcome, Target, TargetKind, Warning};
use crate::selfupdate::{self, Inspection, InstallSource, PlanStatus};
use crate::term::Human;

fn target() -> Target {
    Target::new(TargetKind::SelfTarget, Some("quantex"))
}

fn data(inspection: &Inspection, status: &str, latest: bool, recovery_hint: Option<&str>) -> Value {
    let facts = &inspection.facts;
    let mut map = Map::new();
    map.insert("canAutoUpdate".into(), facts.can_auto_update().into());
    map.insert("channel".into(), facts.update_channel.into());
    map.insert("currentVersion".into(), facts.current_version.into());
    map.insert("installSource".into(), facts.install_source.as_str().into());
    if latest && let Some(version) = &inspection.latest_version {
        map.insert("latestVersion".into(), version.clone().into());
    }
    if let Some(hint) = recovery_hint {
        map.insert("recoveryHint".into(), hint.into());
    }
    map.insert("status".into(), status.into());
    Value::Object(map)
}

/// `MIRROR_LAG`: the selected registry installs an older version than upstream npm has.
fn mirror_lag(inspection: &Inspection) -> Option<Warning> {
    let latest = inspection.latest_version.as_deref()?;
    let upstream = inspection.target.upstream_latest_version.as_deref()?;
    if latest == upstream || !matches!(inspection.facts.install_source, InstallSource::Bun | InstallSource::Npm) {
        return None;
    }
    Some(
        Warning::new(
            "MIRROR_LAG",
            format!(
                "The selected registry currently installs {latest}, while upstream npm has {upstream}. Retry later or set selfUpdateRegistry / QTX_SELF_UPDATE_REGISTRY to another registry if you need the upstream release now."
            ),
        )
        .details(json!({ "installableLatestVersion": latest, "upstreamLatestVersion": upstream })),
    )
}

/// `STALE_LATEST_VERSION`: the resolved latest is older than this build.
fn stale_latest(inspection: &Inspection) -> Option<Warning> {
    let latest = inspection.latest_version.as_deref()?;
    let current = inspection.facts.current_version;
    if crate::probe::compare_versions(latest, current) != Some(std::cmp::Ordering::Less) {
        return None;
    }
    Some(
        Warning::new(
            "STALE_LATEST_VERSION",
            format!(
                "The resolved latest version {latest} is older than the installed Quantex CLI {current}. Quantex will not downgrade; retry with --refresh if you need a fresh check."
            ),
        )
        .details(json!({ "currentVersion": current, "latestVersion": latest })),
    )
}

fn with_warnings(mut outcome: Outcome, warnings: impl IntoIterator<Item = Warning>) -> Outcome {
    for warning in warnings {
        outcome = outcome.with_warning(warning);
    }
    outcome.with_human(render)
}

/// `--channel` accepts stable or beta; anything else falls back to the configured channel.
pub fn upgrade(ctx: &Context, check: bool, channel: Option<&str>) -> Outcome {
    let channel = channel.filter(|channel| matches!(*channel, "stable" | "beta"));
    let inspection = selfupdate::plan(ctx, channel);
    let informational: Vec<Warning> = mirror_lag(&inspection)
        .into_iter()
        .chain(stale_latest(&inspection))
        .collect();
    match inspection.status {
        PlanStatus::UpToDate => {
            return with_warnings(
                Outcome::success("upgrade", Some(target()), data(&inspection, "up-to-date", true, None)),
                informational,
            );
        }
        PlanStatus::CheckUnavailable => {
            return with_warnings(
                Outcome::failure(
                    "upgrade",
                    Some(target()),
                    CommandError::new(
                        ErrorCode::NetworkError,
                        "Unable to determine the latest Quantex CLI version.",
                    ),
                )
                .with_data(data(&inspection, "check-unavailable", false, None)),
                informational,
            );
        }
        PlanStatus::ManualRequired => {
            let hint = selfupdate::recovery_hint(&inspection, None);
            return with_warnings(
                Outcome::failure(
                    "upgrade",
                    Some(target()),
                    CommandError::new(
                        ErrorCode::ManualActionRequired,
                        format!(
                            "Quantex CLI cannot auto-update from the current install source: {}.",
                            inspection.facts.install_source.as_str()
                        ),
                    ),
                )
                .with_data(data(&inspection, "manual-required", true, hint.as_deref())),
                informational,
            );
        }
        PlanStatus::UpdateAvailable => {}
    }
    if check || ctx.dry_run {
        let mut outcome = Outcome::success(
            "upgrade",
            Some(target()),
            data(&inspection, "update-available", true, None),
        );
        if check {
            outcome = outcome.with_exit_code(1);
        }
        let dry_run = ctx
            .dry_run
            .then(|| Warning::new("DRY_RUN", "Dry run: would upgrade Quantex CLI."));
        return with_warnings(outcome, informational.into_iter().chain(dry_run));
    }
    match selfupdate::upgrade(ctx, &inspection) {
        Ok(()) => with_warnings(
            Outcome::success("upgrade", Some(target()), data(&inspection, "updated", true, None)),
            informational,
        ),
        // The runtime reports the timeout or signal that cut the upgrade short.
        Err(None) => Outcome::failure(
            "upgrade",
            Some(target()),
            CommandError::new(ErrorCode::Cancelled, "Self-upgrade invocation was cancelled."),
        ),
        Err(Some(error)) => {
            let hint = selfupdate::recovery_hint(&inspection, Some(&error));
            let recovery = hint
                .as_ref()
                .map(|hint| Warning::new("MANUAL_RECOVERY", format!("Manual recovery: {hint}")));
            with_warnings(
                Outcome::failure(
                    "upgrade",
                    Some(target()),
                    CommandError::new(ErrorCode::UpgradeFailed, error.message.clone())
                        .details(json!({ "kind": error.kind })),
                )
                .with_data(data(&inspection, "manual-required", true, hint.as_deref())),
                mirror_lag(&inspection).into_iter().chain(recovery),
            )
        }
    }
}

fn informational_lines(outcome: &Outcome, human: &mut Human) {
    for warning in &outcome.warnings {
        if warning.code != "DRY_RUN" && warning.code != "MANUAL_RECOVERY" {
            let text = human.yellow(&warning.message);
            human.warn_line(&text);
        }
    }
}

fn render(outcome: &Outcome, human: &mut Human) {
    let Some(data) = &outcome.data else {
        if let Some(error) = &outcome.error {
            human.error_line(&error.message);
        }
        return;
    };
    let current = data["currentVersion"].as_str().unwrap_or_default();
    let latest = data["latestVersion"].as_str();
    match data["status"].as_str().unwrap_or_default() {
        "up-to-date" => {
            let text = human.green(&format!("Quantex CLI is already up to date ({current})."));
            human.line(&text);
            informational_lines(outcome, human);
        }
        "update-available" => {
            let prefix = if outcome.warnings.iter().any(|warning| warning.code == "DRY_RUN") {
                "Dry run: "
            } else {
                ""
            };
            let text = human.yellow(&format!(
                "{prefix}Update available for Quantex CLI: {current} -> {} ({}).",
                latest.unwrap_or_default(),
                data["channel"].as_str().unwrap_or_default()
            ));
            human.warn_line(&text);
            informational_lines(outcome, human);
        }
        "check-unavailable" => {
            if let Some(error) = &outcome.error {
                human.warn_line(&error.message);
            }
            informational_lines(outcome, human);
        }
        "manual-required"
            if outcome
                .error
                .as_ref()
                .is_some_and(|error| error.code == ErrorCode::ManualActionRequired) =>
        {
            if let Some(error) = &outcome.error {
                human.warn_line(&error.message);
            }
            if let Some(hint) = data["recoveryHint"].as_str() {
                let text = human.cyan(&format!("Next step: {hint}"));
                human.warn_line(&text);
            }
        }
        _ => {
            let versions = match latest {
                Some(latest) => format!(" ({current} -> {latest})"),
                None => format!(" ({current})"),
            };
            match &outcome.error {
                None => {
                    let text = human.green(&format!("Quantex CLI upgraded successfully{versions}."));
                    human.line(&text);
                    informational_lines(outcome, human);
                }
                Some(error) => {
                    let text = human.red(&format!("Failed to upgrade Quantex CLI{versions}."));
                    human.error_line(&text);
                    human.warn_line(&format!("Reason: {}", error.message));
                    for warning in &outcome.warnings {
                        let message = warning
                            .message
                            .strip_prefix("Manual recovery:")
                            .map_or_else(|| warning.message.clone(), |rest| format!("Next step:{rest}"));
                        let text = human.cyan(&message);
                        human.warn_line(&text);
                    }
                }
            }
        }
    }
}

/// After a successful human-mode command, mention a newer Quantex that an earlier
/// `upgrade` check found. It reads only the local cache.
pub fn update_notice(ctx: &Context, outcome: &Outcome) {
    if !outcome.ok
        || matches!(outcome.action.as_str(), "doctor" | "upgrade")
        || ctx.output_mode.is_structured()
        || ctx.quiet
    {
        return;
    }
    if let Some((latest, current)) = selfupdate::cached_newer_version(ctx) {
        let mut human = Human::new(ctx);
        let text = human.yellow(&format!(
            "Quantex CLI {latest} is available (current {current}). Run `quantex upgrade`."
        ));
        human.warn_line(&text);
    }
}
