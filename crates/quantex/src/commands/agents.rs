//! Read-only agent commands: `list`, `info`, `inspect`, `resolve`.

use serde_json::{Map, Value, json};

use crate::catalog;
use crate::context::Context;
use crate::observe::{self, Observation, ObserveOptions};
use crate::probe;
use crate::protocol::{CommandError, ErrorCode, Outcome, Target};
use crate::store::{self, State};
use crate::term::{Column, Human};

const COMMAND_RECIPES: &str = "skills/quantex-cli/references/command-recipes.md";

fn load_state(ctx: &Context, action: &str, target: &Target) -> Result<State, Outcome> {
    store::load_state(&ctx.quantex_dir())
        .map_err(|error| Outcome::failure(action, Some(target.clone()), error.into_command_error()))
}

fn unknown_agent(action: &str, name: &str, human: crate::protocol::HumanRenderer) -> Outcome {
    Outcome::failure(
        action,
        Some(Target::agent(name)),
        CommandError::new(ErrorCode::AgentNotFound, format!("Unknown agent: {name}")).details(json!({ "input": name })),
    )
    .with_human(human)
}

fn insert_opt(map: &mut Map<String, Value>, key: &str, value: Option<String>) {
    if let Some(value) = value {
        map.insert(key.into(), value.into());
    }
}

fn observe_one(ctx: &Context, action: &str, name: &str) -> Result<Observation, Outcome> {
    let target = Target::agent(name);
    let state = load_state(ctx, action, &target)?;
    let Some(agent) = catalog::find(name) else {
        return Err(unknown_agent(action, name, render_error));
    };
    Ok(observe::observe(ctx, agent, &state, ObserveOptions::default()))
}

fn render_error(outcome: &Outcome, human: &mut Human) {
    if let Some(error) = &outcome.error {
        human.error_line(&error.message);
    }
}

fn render_warnings(outcome: &Outcome, human: &mut Human) {
    for warning in &outcome.warnings {
        human.warn_line(&warning.message);
    }
}

// ---------------------------------------------------------------------------
// list

pub fn list(ctx: &Context) -> Outcome {
    let target = Target::system("agents");
    let state = match load_state(ctx, "list", &target) {
        Ok(state) => state,
        Err(outcome) => return outcome,
    };
    let observations = observe::observe_all(ctx, &state, ObserveOptions::default());
    let agents: Vec<Value> = observations
        .iter()
        .map(|observation| {
            let mut map = Map::new();
            map.insert("binaryName".into(), observation.agent.binary_name.clone().into());
            map.insert("displayName".into(), observation.agent.display_name.clone().into());
            map.insert("installed".into(), observation.present.into());
            insert_opt(
                &mut map,
                "installedVersion",
                observation.present.then(|| observation.version.clone()).flatten(),
            );
            insert_opt(&mut map, "latestVersion", observation.latest_version.clone());
            map.insert("lifecycle".into(), observation.lifecycle().into());
            map.insert("name".into(), observation.agent.name.clone().into());
            map.insert("sourceLabel".into(), observation.source_label().into());
            map.insert("updateLabel".into(), observation.update_label().into());
            Value::Object(map)
        })
        .collect();
    let mut outcome = Outcome::success("list", Some(target), json!({ "agents": agents })).with_human(render_list);
    for observation in &observations {
        if let Some(warning) = observation.superseded_warning() {
            outcome = outcome.with_warning(warning);
        }
    }
    outcome
}

fn list_source(label: &str) -> String {
    if let Some(rest) = label.strip_prefix("managed via ") {
        return rest.split([' ', '(']).next().unwrap_or(rest).to_owned();
    }
    match label {
        "script installer" => "script".into(),
        "binary installer" => "binary".into(),
        "detected on disk" => "detected".into(),
        _ => "—".into(),
    }
}

fn render_list(outcome: &Outcome, human: &mut Human) {
    if outcome.error.is_some() {
        return render_error(outcome, human);
    }
    let Some(data) = &outcome.data else { return };
    let agents = data["agents"].as_array().cloned().unwrap_or_default();
    let superseded: Vec<String> = outcome
        .warnings
        .iter()
        .filter(|warning| warning.code == "AGENT_PACKAGE_SUPERSEDED")
        .filter_map(|warning| warning.details.as_ref()?["agentName"].as_str().map(str::to_owned))
        .collect();
    human.heading("AI Agents:");
    let dash = || "—".to_owned();
    let rows: Vec<Vec<String>> = agents
        .iter()
        .map(|agent| {
            let installed = agent["installed"] == true;
            let text = |key: &str| agent[key].as_str().unwrap_or_default().to_owned();
            let available = if superseded.contains(&text("name")) {
                human.yellow("migrate")
            } else {
                match (agent["installedVersion"].as_str(), agent["latestVersion"].as_str()) {
                    (Some(current), Some(latest)) if installed && probe::is_version_newer(latest, current) => {
                        human.cyan(latest)
                    }
                    _ => human.dim("—"),
                }
            };
            vec![
                text("displayName"),
                if installed { human.green("yes") } else { human.dim("no") },
                human.dim(&if installed {
                    agent["installedVersion"].as_str().unwrap_or("unknown").to_owned()
                } else {
                    dash()
                }),
                human.dim(&if installed {
                    list_source(&text("sourceLabel"))
                } else {
                    dash()
                }),
                if installed {
                    human.cyan(text("updateLabel").trim_end_matches(" update"))
                } else {
                    human.dim("—")
                },
                available,
            ]
        })
        .collect();
    human.table(
        &[
            Column::new("Agent"),
            Column::new("Installed"),
            Column::new("Version").max(22),
            Column::new("Source"),
            Column::new("Managed"),
            Column::new("Available"),
        ],
        &rows,
    );
    let installed = agents.iter().filter(|agent| agent["installed"] == true).count();
    human.blank();
    let summary = human.dim(&format!(
        "{installed} installed · {} not installed",
        agents.len() - installed
    ));
    human.paragraph(&summary, "  ");
    let hint = human.dim("Details: qtx info <agent>");
    human.paragraph(&hint, "  ");
    human.blank();
    render_warnings(outcome, human);
}

// ---------------------------------------------------------------------------
// info / inspect

fn inspection_fields(observation: &Observation) -> Value {
    let mut map = Map::new();
    insert_opt(&mut map, "binaryPath", observation.path_string());
    map.insert("installed".into(), observation.present.into());
    insert_opt(
        &mut map,
        "installedVersion",
        observation.present.then(|| observation.version.clone()).flatten(),
    );
    insert_opt(&mut map, "latestVersion", observation.latest_version.clone());
    map.insert("lifecycle".into(), observation.lifecycle().into());
    insert_opt(
        &mut map,
        "sourceLabel",
        observation.present.then(|| observation.source_label()),
    );
    map.insert("updateLabel".into(), observation.update_label().into());
    Value::Object(map)
}

fn agent_fields(human: &Human, data: &Value) -> Vec<(&'static str, String)> {
    let agent = &data["agent"];
    let inspection = &data["inspection"];
    let text = |value: &Value| value.as_str().unwrap_or_default().to_owned();
    let list = |value: &Value| {
        let items: Vec<String> = value
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|item| item.as_str().map(str::to_owned))
            .collect();
        items
    };
    let aliases = list(&agent["aliases"]).join(", ");
    let self_update = list(&agent["selfUpdateCommands"]).join(" · ");
    let mut fields = vec![
        ("Name", text(&agent["name"])),
        ("Aliases", if aliases.is_empty() { "—".into() } else { aliases }),
        ("Package", agent["packageName"].as_str().unwrap_or("—").to_owned()),
        ("Binary", text(&agent["binaryName"])),
        (
            "Installed",
            if inspection["installed"] == true {
                human.green("yes")
            } else {
                human.red("no")
            },
        ),
    ];
    // `updateLabel` is a contract value; say who runs the update in words instead.
    if inspection["installed"] == true
        && let Some(label) = inspection["updateLabel"].as_str()
    {
        let via = match label {
            "managed update" => "qtx update",
            "command update" => "the agent's own updater",
            _ => "manual steps",
        };
        fields.push(("Updates via", via.to_owned()));
    }
    fields.push((
        "Self update",
        if self_update.is_empty() {
            "—".into()
        } else {
            self_update
        },
    ));
    for (label, key) in [
        ("Source", "sourceLabel"),
        ("Lifecycle", "lifecycle"),
        ("Version", "installedVersion"),
        ("Latest", "latestVersion"),
        ("Path", "binaryPath"),
    ] {
        // `lifecycle` reads `unmanaged` for an absent agent, which says nothing useful.
        if key == "lifecycle" && inspection["installed"] != true {
            continue;
        }
        if let Some(value) = inspection[key].as_str() {
            fields.push((label, value.to_owned()));
        }
    }
    fields
}

fn render_methods(human: &mut Human, data: &Value) {
    human.heading("Install Methods");
    let methods = data["agent"]["installMethods"].as_array().cloned().unwrap_or_default();
    if methods.is_empty() {
        let text = human.dim("  No managed install methods");
        human.line(&text);
        return;
    }
    let rows: Vec<Vec<String>> = methods
        .iter()
        .map(|method| {
            vec![
                human.green(method["label"].as_str().unwrap_or_default()),
                method["command"].as_str().unwrap_or_default().to_owned(),
            ]
        })
        .collect();
    human.table(
        &[Column::new("Method").max(24), Column::new("Command").wrapping()],
        &rows,
    );
}

pub fn info(ctx: &Context, name: &str) -> Outcome {
    let observation = match observe_one(ctx, "info", name) {
        Ok(observation) => observation,
        Err(outcome) => return outcome.with_human(render_info),
    };
    let capabilities = json!({
        "canAutoInstall": !observation.methods.is_empty(),
        "canAutoUninstall": observation.present && observation.lifecycle() == "managed",
        "canRun": observation.present,
        "canSelfUpdate": !observation.self_update_commands().is_empty(),
    });
    let mut outcome = Outcome::success(
        "info",
        Some(Target::agent(&observation.agent.name)),
        json!({
            "agent": observation.agent_summary(),
            "capabilities": capabilities,
            "inspection": inspection_fields(&observation),
        }),
    )
    .with_human(render_info);
    if let Some(warning) = observation.superseded_warning() {
        outcome = outcome.with_warning(warning);
    }
    outcome
}

fn render_info(outcome: &Outcome, human: &mut Human) {
    if outcome.error.is_some() {
        return render_error(outcome, human);
    }
    let Some(data) = &outcome.data else { return };
    human.heading(data["agent"]["displayName"].as_str().unwrap_or_default());
    let fields = agent_fields(human, data);
    human.fields(&fields);
    human.heading("Capabilities");
    let capabilities = &data["capabilities"];
    let rows: Vec<Vec<String>> = [
        ("Auto install", "canAutoInstall"),
        ("Self update", "canSelfUpdate"),
        ("Auto uninstall", "canAutoUninstall"),
        ("Runnable", "canRun"),
    ]
    .iter()
    .map(|(label, key)| {
        vec![
            (*label).to_owned(),
            if capabilities[*key] == true {
                human.green("yes")
            } else {
                human.dim("no")
            },
        ]
    })
    .collect();
    human.table(&[Column::new("Capability"), Column::new("Available")], &rows);
    render_methods(human, data);
    human.blank();
    render_warnings(outcome, human);
}

// ---------------------------------------------------------------------------
// resolve

pub fn resolve(ctx: &Context, name: &str) -> Outcome {
    let observation = match observe_one(ctx, "resolve", name) {
        Ok(observation) => observation,
        Err(outcome) => return outcome.with_human(render_resolve),
    };
    let agent = observation.agent;
    let target = Some(Target::agent(&agent.name));
    let agent_value = json!({
        "binaryName": agent.binary_name,
        "displayName": agent.display_name,
        "name": agent.name,
    });
    let Some(path) = observation.path_string().filter(|_| observation.present) else {
        let methods: Vec<Value> = observe::method_rows(agent, &observation.methods)
            .into_iter()
            .filter(|row| row["command"].as_str().is_some_and(|command| !command.is_empty()))
            .collect();
        let guidance = json!({
            "docsRef": COMMAND_RECIPES,
            "installMethods": methods,
            "suggestedAction": "ensure-agent-installed",
            "suggestedEnsureCommand": format!("quantex ensure {}", agent.name),
        });
        let resolution = json!({
            "binaryPath": "",
            "installGuidance": guidance,
            "installSource": "not-installed",
            "installed": false,
            "lifecycle": "unmanaged",
            "sourceLabel": "not installed",
            "suggestedLaunchCommand": [],
        });
        return Outcome::failure(
            "resolve",
            target,
            CommandError::new(
                ErrorCode::AgentNotInstalled,
                format!("{} is not installed.", agent.display_name),
            )
            .details(guidance),
        )
        .with_data(json!({ "agent": agent_value, "resolution": resolution }))
        .with_human(render_resolve);
    };
    let mut resolution = Map::new();
    resolution.insert("binaryPath".into(), path.clone().into());
    resolution.insert("installed".into(), true.into());
    resolution.insert(
        "installSource".into(),
        observation
            .installed
            .as_ref()
            .map_or("detected-in-path", |installed| installed.install_type.as_str())
            .into(),
    );
    insert_opt(&mut resolution, "installedVersion", observation.version.clone());
    resolution.insert("lifecycle".into(), observation.lifecycle().into());
    resolution.insert("sourceLabel".into(), observation.source_label().into());
    resolution.insert("suggestedLaunchCommand".into(), json!([path]));
    Outcome::success(
        "resolve",
        target,
        json!({ "agent": agent_value, "resolution": Value::Object(resolution) }),
    )
    .with_human(render_resolve)
}

fn render_resolve(outcome: &Outcome, human: &mut Human) {
    if let Some(error) = &outcome.error {
        human.error_line(&error.message);
        if let Some(details) = &error.details
            && let Some(command) = details["suggestedEnsureCommand"].as_str()
        {
            eprintln!("Install it with: {command}");
        }
        return;
    }
    let Some(data) = &outcome.data else { return };
    let agent = &data["agent"];
    let resolution = &data["resolution"];
    let text = |value: &Value| value.as_str().unwrap_or_default().to_owned();
    human.heading(agent["displayName"].as_str().unwrap_or_default());
    let mut fields = vec![
        ("Name", text(&agent["name"])),
        ("Binary", text(&agent["binaryName"])),
        ("Path", text(&resolution["binaryPath"])),
        ("Source", text(&resolution["sourceLabel"])),
        ("Lifecycle", text(&resolution["lifecycle"])),
        ("Install type", text(&resolution["installSource"])),
    ];
    if let Some(version) = resolution["installedVersion"].as_str() {
        fields.push(("Version", version.to_owned()));
    }
    let launch: Vec<&str> = resolution["suggestedLaunchCommand"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect();
    fields.push(("Launch", launch.join(" ")));
    human.fields(&fields);
    human.blank();
}
