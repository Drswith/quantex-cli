//! `commands`: discovery of the command surface itself.

use serde_json::{Value, json};

use crate::contract;
use crate::protocol::{Outcome, Target};
use crate::term::{Column, Human};

pub fn commands() -> Outcome {
    let commands: Vec<Value> = contract::registry()
        .commands
        .iter()
        .map(|command| {
            json!({
                "flags": command.flags,
                "name": command.name,
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
    let hint = human.dim("Machine-readable: qtx commands --json");
    human.paragraph(&hint, "  ");
    human.blank();
}
