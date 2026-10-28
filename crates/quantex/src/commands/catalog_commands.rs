//! `commands` and `schema`: discovery of the command surface itself.

use serde_json::{Value, json};

use crate::contract;
use crate::protocol::{CommandError, ErrorCode, Outcome, Target};
use crate::term::{Column, Human};

pub fn commands() -> Outcome {
    let commands: Vec<Value> = contract::registry()
        .commands
        .iter()
        .map(|command| {
            json!({
                "flags": command.flags,
                "name": command.name,
                "outputSchemaRef": format!("#/commands/{}", command.name),
                "stability": "stable",
                "summary": command.summary,
            })
        })
        .collect();
    Outcome::success(
        "commands",
        Some(Target::system("commands")),
        json!({ "commands": commands }),
    )
    .with_human(render_commands)
}

fn render_commands(outcome: &Outcome, human: &mut Human) {
    let Some(data) = &outcome.data else { return };
    human.heading("Quantex Commands");
    let rows: Vec<Vec<String>> = data["commands"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|command| {
            vec![
                human.cyan(command["name"].as_str().unwrap_or_default()),
                command["summary"].as_str().unwrap_or_default().to_owned(),
            ]
        })
        .collect();
    human.table(
        &[Column::new("Command").max(24), Column::new("Summary").wrapping()],
        &rows,
    );
    human.blank();
    let hint = human.dim("Contracts: qtx commands --json · Schemas: qtx schema <command>");
    human.paragraph(&hint, "  ");
    human.blank();
}

pub fn schema(command: Option<&str>) -> Outcome {
    let documents = contract::schemas().as_array().cloned().unwrap_or_default();
    let selected: Vec<Value> = match command {
        Some(name) => documents
            .into_iter()
            .filter(|document| document["name"] == name)
            .collect(),
        None => documents,
    };
    let target = Some(Target::system("schema"));
    if let Some(name) = command
        && selected.is_empty()
    {
        return Outcome::failure(
            "schema",
            target,
            CommandError::new(ErrorCode::InvalidArgument, format!("Unknown schema target: {name}"))
                .details(json!({ "command": name })),
        );
    }
    Outcome::success("schema", target, json!({ "commands": selected })).with_human(render_schema)
}

fn render_schema(outcome: &Outcome, human: &mut Human) {
    if let Some(error) = &outcome.error {
        human.error_line(&error.message);
        return;
    }
    let Some(data) = &outcome.data else { return };
    human.heading("Quantex Schemas");
    let rows: Vec<Vec<String>> = data["commands"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|document| {
            vec![
                human.cyan(document["name"].as_str().unwrap_or_default()),
                document["description"].as_str().unwrap_or_default().to_owned(),
            ]
        })
        .collect();
    human.table(
        &[Column::new("Command").max(24), Column::new("Description").wrapping()],
        &rows,
    );
    human.blank();
    let hint = human.dim("Document: qtx schema <command> --json");
    human.paragraph(&hint, "  ");
    human.blank();
}
