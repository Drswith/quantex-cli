//! Environment commands: `capabilities` and `doctor`.

use serde_json::{Map, Value, json};

use crate::catalog::Provider;
use crate::context::Context;
use crate::observe::{self, ObserveOptions};
use crate::probe;
use crate::protocol::{Outcome, Target};
use crate::selfupdate::{self, InstallSource};
use crate::store;
use crate::term::{Column, Human};

const TROUBLESHOOTING_DOCS: &str = "docs/runbooks/quantex-troubleshooting.md";
const SELF_UPGRADE_DOCS: &str = "docs/runbooks/release-and-self-upgrade-debugging.md";

/// "bun, npm, or brew" for the installers this platform's catalog uses.
fn installer_names(availability: &[(Provider, bool)]) -> String {
    let names: Vec<&str> = availability.iter().map(|(provider, _)| provider.as_str()).collect();
    match names.split_last() {
        Some((last, [])) => (*last).to_owned(),
        Some((last, rest)) => format!("{}, or {last}", rest.join(", ")),
        None => "a package manager".to_owned(),
    }
}

#[allow(clippy::too_many_arguments)]
fn issue(
    category: &str,
    code: &str,
    blocking: bool,
    docs: &str,
    message: String,
    subject: Value,
    action: &str,
    commands: Vec<String>,
) -> Value {
    json!({
        "blocking": blocking,
        "category": category,
        "code": code,
        "docsRef": docs,
        "message": message,
        "severity": "warning",
        "subject": subject,
        "suggestedAction": action,
        "suggestedCommands": commands,
    })
}

pub fn doctor(ctx: &Context) -> Outcome {
    let target = Target::system("doctor");
    let state = match store::load_state(&ctx.quantex_dir()) {
        Ok(state) => state,
        Err(error) => return Outcome::failure("doctor", Some(target), error.into_command_error()),
    };
    crate::term::progress(ctx, "Checking installers, agents, and the latest Quantex version...");
    let (availability, inspection, observations) = std::thread::scope(|scope| {
        let availability = scope.spawn(probe::installer_availability);
        let inspection = scope.spawn(|| selfupdate::inspect(ctx, None));
        let observations = observe::observe_all(ctx, &state, ObserveOptions::default());
        // Untracked: on disk with no record that accounts for it, which for a recorded
        // agent takes a provider probe; only agents on disk need one.
        let untracked: Vec<String> = std::thread::scope(|scope| {
            let handles: Vec<_> = observations
                .iter()
                .filter(|observation| observation.present)
                .map(|observation| {
                    let state = &state;
                    scope.spawn(move || {
                        let view = crate::lifecycle::observe_lifecycle(ctx, observation.agent, state);
                        (view.status == crate::lifecycle::Status::Untracked).then(|| observation.agent.name.clone())
                    })
                })
                .collect();
            handles
                .into_iter()
                .filter_map(|handle| handle.join().unwrap())
                .collect()
        });
        (
            availability.join().unwrap(),
            inspection.join().unwrap(),
            (observations, untracked),
        )
    });
    let (observations, untracked) = observations;
    let available = |provider: Provider| {
        availability
            .iter()
            .any(|(candidate, available)| *candidate == provider && *available)
    };
    let mut installers = Map::new();
    for (provider, is_available) in &availability {
        installers.insert(provider.as_str().into(), (*is_available).into());
    }
    let facts = &inspection.facts;
    let source = facts.install_source;
    let current = facts.current_version;
    let latest = inspection.latest_version.clone();
    let self_outdated = latest
        .as_deref()
        .is_some_and(|latest| probe::is_version_newer(latest, current));
    let mut issues = Vec::new();
    if availability.iter().all(|(_, available)| !available) {
        issues.push(issue(
            "installers",
            "NO_MANAGED_INSTALLER",
            true,
            TROUBLESHOOTING_DOCS,
            format!(
                "No managed installer found. Install {} before relying on managed lifecycle operations.",
                installer_names(&availability)
            ),
            json!({ "kind": "system" }),
            "restore-managed-installer",
            Vec::new(),
        ));
    }
    let self_subject = json!({ "kind": "self", "name": "quantex" });
    if (source == InstallSource::Bun && !available(Provider::Bun))
        || (source == InstallSource::Npm && !available(Provider::Npm))
    {
        let tag = if facts.update_channel == "beta" {
            "beta"
        } else {
            "latest"
        };
        let command = match source {
            InstallSource::Bun => format!("bun add -g {}@{tag}", selfupdate::PACKAGE_NAME),
            _ => format!("npm install -g {}@{tag}", selfupdate::PACKAGE_NAME),
        };
        issues.push(issue(
            "self",
            "SELF_INSTALLER_MISSING",
            true,
            SELF_UPGRADE_DOCS,
            format!(
                "Quantex CLI is tracked as a {0} install, but {0} is not available in PATH. Reinstall that package manager or reinstall Quantex from a supported source.",
                source.as_str()
            ),
            self_subject.clone(),
            "restore-self-installer",
            vec![command],
        ));
    }
    if !facts.can_auto_update() {
        issues.push(issue(
            "self",
            "SELF_AUTO_UPDATE_UNAVAILABLE",
            false,
            SELF_UPGRADE_DOCS,
            format!(
                "Quantex CLI cannot auto-update from install source \"{}\". Reinstall with the standalone binary (install.sh or install.ps1), bun, or npm if you want `quantex upgrade` support.",
                source.as_str()
            ),
            self_subject.clone(),
            "reinstall-self-with-auto-update-source",
            Vec::new(),
        ));
    }
    if self_outdated && let Some(command) = inspection.recommended_upgrade_command() {
        issues.push(issue(
            "self",
            "SELF_UPDATE_AVAILABLE",
            false,
            SELF_UPGRADE_DOCS,
            format!(
                "Quantex CLI {current} is behind {}. Run {command}.",
                latest.as_deref().unwrap_or_default()
            ),
            self_subject.clone(),
            "run-self-upgrade",
            vec![command.to_owned()],
        ));
    }
    let mut agents = Vec::new();
    for observation in observations.iter().filter(|observation| observation.present) {
        let agent = observation.agent;
        let installed_version = observation.version.clone();
        let latest_version = observation.latest_version.clone();
        let outdated = matches!((&installed_version, &latest_version), (Some(a), Some(b)) if a != b);
        let mut summary = Map::new();
        summary.insert("displayName".into(), agent.display_name.clone().into());
        if let Some(version) = &installed_version {
            summary.insert("installedVersion".into(), version.clone().into());
        }
        if let Some(version) = &latest_version {
            summary.insert("latestVersion".into(), version.clone().into());
        }
        summary.insert("lifecycle".into(), observation.lifecycle().into());
        summary.insert("outdated".into(), outdated.into());
        summary.insert("sourceLabel".into(), observation.source_label().into());
        agents.push(Value::Object(summary));

        let subject = json!({ "kind": "agent", "name": agent.name });
        if untracked.contains(&agent.name) {
            issues.push(issue(
                "agent",
                "AGENT_UNTRACKED_IN_PATH",
                false,
                TROUBLESHOOTING_DOCS,
                format!(
                    "{} is detected on disk but not tracked as a managed Quantex install. Use `quantex inspect {} --json` to confirm the source, then reinstall through Quantex if you want managed lifecycle operations.",
                    agent.display_name, agent.name
                ),
                subject.clone(),
                "inspect-agent-install-source",
                vec![
                    format!("quantex inspect {} --json", agent.name),
                    format!("quantex install {}", agent.name),
                ],
            ));
        }
        if !outdated || observation.lifecycle() == "managed" {
            continue;
        }
        let self_update = agent.self_update.as_ref().map(|update| update.command.join(" "));
        let hint = match &self_update {
            Some(command) => format!("Try running {command} directly."),
            None => format!("Check {} for the recommended update path.", agent.homepage),
        };
        issues.push(issue(
            "agent",
            "AGENT_MANUAL_UPDATE_REQUIRED",
            false,
            TROUBLESHOOTING_DOCS,
            format!(
                "{} {} is behind {}, but the current source is {}. {hint}",
                agent.display_name,
                installed_version.as_deref().unwrap_or_default(),
                latest_version.as_deref().unwrap_or_default(),
                observation.source_label()
            ),
            subject,
            if self_update.is_some() {
                "run-agent-self-update"
            } else {
                "follow-manual-agent-update"
            },
            self_update.into_iter().collect(),
        ));
    }
    let mut self_summary = Map::new();
    self_summary.insert("canAutoUpdate".into(), facts.can_auto_update().into());
    self_summary.insert("currentVersion".into(), current.into());
    self_summary.insert("installSource".into(), source.as_str().into());
    if let Some(latest) = &latest {
        self_summary.insert("latestVersion".into(), latest.clone().into());
    }
    self_summary.insert("outdated".into(), self_outdated.into());
    let data = json!({
        "agents": agents,
        "installers": installers,
        "issues": issues,
        "self": self_summary,
    });
    Outcome::success("doctor", Some(target), data).with_human(render_doctor)
}

fn render_doctor(outcome: &Outcome, human: &mut Human) {
    if let Some(error) = &outcome.error {
        human.error_line(&error.message);
        return;
    }
    let Some(data) = &outcome.data else { return };
    human.heading("Quantex Doctor");
    let self_data = &data["self"];
    human.fields(&[
        (
            "Quantex",
            format!(
                "{} ({})",
                self_data["currentVersion"].as_str().unwrap_or_default(),
                self_data["installSource"].as_str().unwrap_or_default()
            ),
        ),
        (
            "Latest",
            match self_data["latestVersion"].as_str() {
                Some(latest) if self_data["outdated"] == true => human.yellow(latest),
                Some(latest) => latest.to_owned(),
                None => human.dim("unknown"),
            },
        ),
        (
            "Auto update",
            if self_data["canAutoUpdate"] == true {
                human.green("yes")
            } else {
                human.dim("no")
            },
        ),
    ]);
    human.heading("Installers");
    let rows: Vec<Vec<String>> = data["installers"]
        .as_object()
        .into_iter()
        .flatten()
        .map(|(name, available)| {
            vec![
                name.clone(),
                if available == true {
                    human.green("yes")
                } else {
                    human.dim("no")
                },
            ]
        })
        .collect();
    human.table(&[Column::new("Installer"), Column::new("Available")], &rows);
    human.heading("Installed Agents");
    let agents = data["agents"].as_array().cloned().unwrap_or_default();
    if agents.is_empty() {
        let text = human.dim("  No agents detected");
        human.line(&text);
    } else {
        let rows: Vec<Vec<String>> = agents
            .iter()
            .map(|agent| {
                vec![
                    agent["displayName"].as_str().unwrap_or_default().to_owned(),
                    agent["installedVersion"].as_str().unwrap_or("unknown").to_owned(),
                    agent["sourceLabel"].as_str().unwrap_or_default().to_owned(),
                ]
            })
            .collect();
        human.table(
            &[
                Column::new("Agent"),
                Column::new("Version"),
                Column::new("Source").wrapping(),
            ],
            &rows,
        );
    }
    let issues = data["issues"].as_array().cloned().unwrap_or_default();
    human.heading("Issues");
    if issues.is_empty() {
        let text = human.green("  No issues found.");
        human.line(&text);
    }
    for issue in &issues {
        let message = issue["message"].as_str().unwrap_or_default();
        human.paragraph(&format!("- {message}"), "  ");
    }
    human.blank();
}
