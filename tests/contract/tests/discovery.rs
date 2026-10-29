//! `--version` and `commands`: the discovery surface agents read first.

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
                    "stability": "stable",
                    "summary": command["summary"],
                })
            })
            .collect(),
    )
}

#[test]
fn commands_returns_the_stable_catalog() {
    let run = Sandbox::new().run(["commands", "--json"]);
    assert_eq!(run.code, 0, "{run:?}");
    assert_eq!(run.stderr, "");
    let envelope = run.json();
    assert_envelope(&envelope, "commands");
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
        assert_envelope(&run.json(), "commands");
    }
}

#[test]
fn output_defaults_to_human_without_an_explicit_mode() {
    // Structured output always needs --json, also on non-TTY streams.
    let run = Sandbox::new().run(["commands"]);
    assert_eq!(run.code, 0, "{run:?}");
    assert!(!run.stdout.trim().is_empty(), "{run:?}");
    assert!(
        serde_json::from_str::<serde_json::Value>(&run.stdout).is_err(),
        "{run:?}"
    );
}

#[test]
fn run_id_comes_from_the_flag_or_the_environment() {
    let mut sandbox = Sandbox::new();
    let run = sandbox.run(["commands", "--json", "--run-id", "flag-run"]);
    assert_eq!(run.json()["meta"]["runId"], "flag-run");
    sandbox.env("QUANTEX_RUN_ID", "env-run");
    let run = sandbox.run(["commands", "--json"]);
    assert_eq!(run.json()["meta"]["runId"], "env-run");
}
