//! `--version`, `commands`, and `schema`: the discovery surface agents read first.

use quantex_contract_tests::{Sandbox, assert_envelope, contract_json};
use serde_json::{Value, json};

fn is_version(text: &str) -> bool {
    let core = text.split(['-', '+']).next().unwrap_or_default();
    let parts: Vec<&str> = core.split('.').collect();
    parts.len() == 3
        && parts
            .iter()
            .all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()))
}

#[test]
fn version_flags_print_the_version() {
    let sandbox = Sandbox::new();
    for flag in ["--version", "-V"] {
        let run = sandbox.run([flag]);
        assert_eq!(run.code, 0, "{flag}: {run:?}");
        assert!(is_version(run.stdout.trim()), "{flag} printed {:?}", run.stdout);
    }
}

fn expected_command_descriptors() -> Value {
    let registry = contract_json("cli/registry.json");
    let commands = registry["commands"].as_array().unwrap();
    Value::Array(
        commands
            .iter()
            .map(|command| {
                json!({
                    "flags": command["flags"],
                    "name": command["name"],
                    "outputSchemaRef": format!("#/commands/{}", command["name"].as_str().unwrap()),
                    "stability": "stable",
                    "summary": command["summary"],
                })
            })
            .collect(),
    )
}

#[test]
fn commands_returns_the_stable_catalog() {
    let run = Sandbox::new().run(["commands", "--output", "json"]);
    assert_eq!(run.code, 0, "{run:?}");
    assert_eq!(run.stderr, "");
    let envelope = run.json();
    assert_envelope(&envelope, "commands", "json");
    assert_eq!(envelope["ok"], true);
    assert_eq!(envelope["target"], json!({ "kind": "system", "name": "commands" }));
    assert_eq!(envelope["data"]["commands"], expected_command_descriptors());
}

#[test]
fn json_flag_selects_json_mode_in_any_position() {
    let sandbox = Sandbox::new();
    for args in [["commands", "--json"], ["--json", "commands"]] {
        let run = sandbox.run(args);
        assert_eq!(run.code, 0, "{args:?}: {run:?}");
        assert_envelope(&run.json(), "commands", "json");
    }
}

#[test]
fn output_defaults_to_human_without_an_explicit_mode() {
    // v1 never switched to JSON on non-TTY streams (Node and Bun report isTTY as
    // undefined for pipes), so structured output always needs --json or --output.
    let run = Sandbox::new().run(["commands"]);
    assert_eq!(run.code, 0, "{run:?}");
    assert!(!run.stdout.trim().is_empty(), "{run:?}");
    assert!(
        serde_json::from_str::<serde_json::Value>(&run.stdout).is_err(),
        "{run:?}"
    );
}

#[test]
fn schema_returns_every_document() {
    let run = Sandbox::new().run(["schema", "--output", "json"]);
    assert_eq!(run.code, 0, "{run:?}");
    let envelope = run.json();
    assert_envelope(&envelope, "schema", "json");
    assert_eq!(envelope["target"], json!({ "kind": "system", "name": "schema" }));
    assert_eq!(envelope["data"]["commands"], contract_json("cli/schemas.json"));
}

#[test]
fn schema_returns_one_document_by_name() {
    let run = Sandbox::new().run(["schema", "list", "--output", "json"]);
    assert_eq!(run.code, 0, "{run:?}");
    let schemas = contract_json("cli/schemas.json");
    let list = schemas
        .as_array()
        .unwrap()
        .iter()
        .find(|document| document["name"] == "list")
        .unwrap();
    assert_eq!(run.json()["data"]["commands"], json!([list]));
}

#[test]
fn schema_rejects_an_unknown_target() {
    let run = Sandbox::new().run(["schema", "nosuch", "--output", "json"]);
    assert_eq!(run.code, 2, "{run:?}");
    let envelope = run.json();
    assert_envelope(&envelope, "schema", "json");
    assert_eq!(envelope["ok"], false);
    assert!(envelope.get("data").is_none(), "failed results omit data: {envelope}");
    assert_eq!(
        envelope["error"],
        json!({
            "code": "INVALID_ARGUMENT",
            "details": { "command": "nosuch" },
            "message": "Unknown schema target: nosuch",
        })
    );
}

#[test]
fn ndjson_wraps_the_result_envelope_in_a_result_event() {
    let run = Sandbox::new().run(["commands", "--output", "ndjson"]);
    assert_eq!(run.code, 0, "{run:?}");
    let events = run.ndjson();
    assert_eq!(events.len(), 1, "{events:?}");
    let event = &events[0];
    assert_eq!(event["type"], "result");
    assert_eq!(event["action"], "commands");
    assert_eq!(event["meta"]["mode"], "ndjson");
    assert_eq!(event["target"], event["data"]["target"]);
    assert_envelope(&event["data"], "commands", "ndjson");
    assert_eq!(event["data"]["data"]["commands"], expected_command_descriptors());
}

#[test]
fn run_id_comes_from_the_flag_or_the_environment() {
    let mut sandbox = Sandbox::new();
    let run = sandbox.run(["commands", "--output", "json", "--run-id", "flag-run"]);
    assert_eq!(run.json()["meta"]["runId"], "flag-run");
    sandbox.env("QUANTEX_RUN_ID", "env-run");
    let run = sandbox.run(["commands", "--output", "json"]);
    assert_eq!(run.json()["meta"]["runId"], "env-run");
}
