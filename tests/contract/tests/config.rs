//! `config`: listing, reading, writing, and resetting `~/.quantex/config.json`.

use std::fs;

use quantex_contract_tests::{Run, Sandbox, assert_envelope};
use serde_json::{Value, json};

fn config_json(sandbox: &Sandbox, args: &[&str]) -> (Run, Value) {
    let mut full = vec!["config"];
    full.extend_from_slice(args);
    full.extend_from_slice(&["--json"]);
    let run = sandbox.run(&full);
    let envelope = run.json();
    assert_envelope(&envelope, "config");
    (run, envelope)
}

fn file(sandbox: &Sandbox) -> Value {
    serde_json::from_str(&fs::read_to_string(sandbox.quantex_dir().join("config.json")).unwrap()).unwrap()
}

#[test]
fn list_returns_the_effective_configuration() {
    let sandbox = Sandbox::new();
    let (run, envelope) = config_json(&sandbox, &[]);
    assert_eq!(run.code, 0, "{run:?}");
    assert_eq!(envelope["target"], json!({ "kind": "config" }));
    assert_eq!(envelope["data"]["action"], "list");
    let config = &envelope["data"]["config"];
    assert_eq!(
        config,
        &json!({ "defaultPackageManager": "bun", "networkTimeoutMs": 1, "selfUpdateChannel": "stable" })
    );
}

#[test]
fn get_returns_one_value() {
    let sandbox = Sandbox::new();
    let (run, envelope) = config_json(&sandbox, &["get", "networkTimeoutMs"]);
    assert_eq!(run.code, 0, "{run:?}");
    assert_eq!(
        envelope["target"],
        json!({ "kind": "config", "name": "networkTimeoutMs" })
    );
    assert_eq!(
        envelope["data"],
        json!({ "action": "get", "key": "networkTimeoutMs", "value": 1 })
    );

    let (_, envelope) = config_json(&sandbox, &["get", "noSuchKey"]);
    assert_eq!(envelope["data"], json!({ "action": "get", "key": "noSuchKey" }));
}

#[test]
fn set_validates_and_persists() {
    let sandbox = Sandbox::new();
    let (run, envelope) = config_json(&sandbox, &["set", "networkTimeoutMs", "2500"]);
    assert_eq!(run.code, 0, "{run:?}");
    assert_eq!(
        envelope["data"],
        json!({ "action": "set", "key": "networkTimeoutMs", "value": 2500 })
    );
    let stored = file(&sandbox);
    assert_eq!(stored["networkTimeoutMs"], 2500);
    assert_eq!(
        stored["defaultPackageManager"], "bun",
        "set writes the full effective config"
    );

    let (_, envelope) = config_json(
        &sandbox,
        &["set", "selfUpdateRegistry", "https://Registry.Example.com/npm/"],
    );
    assert_eq!(envelope["data"]["value"], "https://registry.example.com/npm");

    for (key, value, message) in [
        (
            "networkRetries",
            "3",
            "Unknown config key: networkRetries. Supported keys: defaultPackageManager, networkTimeoutMs, selfUpdateChannel, selfUpdateRegistry",
        ),
        (
            "networkTimeoutMs",
            "zero",
            "networkTimeoutMs must be a positive integer",
        ),
        (
            "defaultPackageManager",
            "pnpm",
            "defaultPackageManager must be bun or npm",
        ),
        (
            "selfUpdateChannel",
            "nightly",
            "selfUpdateChannel must be stable or beta",
        ),
        (
            "selfUpdateRegistry",
            "not a url",
            "selfUpdateRegistry must be a valid absolute URL",
        ),
    ] {
        let (run, envelope) = config_json(&sandbox, &["set", key, value]);
        assert_eq!(run.code, 2, "{key}={value}: {run:?}");
        assert_eq!(envelope["error"]["code"], "INVALID_ARGUMENT");
        assert_eq!(envelope["error"]["message"], message);
        assert_eq!(envelope["target"], json!({ "kind": "config", "name": key }));
    }
}

#[test]
fn set_and_get_require_their_arguments() {
    let sandbox = Sandbox::new();
    let (run, envelope) = config_json(&sandbox, &["get"]);
    assert_eq!(run.code, 2, "{run:?}");
    assert_eq!(envelope["error"]["message"], "Please specify a key");
    let (run, envelope) = config_json(&sandbox, &["set", "networkTimeoutMs"]);
    assert_eq!(run.code, 2, "{run:?}");
    assert_eq!(envelope["error"]["message"], "Please specify both key and value");
}

#[test]
fn reset_restores_defaults() {
    let sandbox = Sandbox::new();
    let (run, envelope) = config_json(&sandbox, &["reset"]);
    assert_eq!(run.code, 0, "{run:?}");
    let defaults = json!({
        "defaultPackageManager": "bun",
        "networkTimeoutMs": 10000,
        "selfUpdateChannel": "stable",
    });
    assert_eq!(envelope["data"], json!({ "action": "reset", "config": defaults }));
    assert_eq!(file(&sandbox), defaults);
}

#[test]
fn unknown_actions_list_the_available_ones() {
    let (run, envelope) = config_json(&Sandbox::new(), &["frobnicate"]);
    assert_eq!(run.code, 2, "{run:?}");
    assert_eq!(
        envelope["error"],
        json!({
            "code": "INVALID_ARGUMENT",
            "details": { "action": "frobnicate" },
            "message": "Unknown action: frobnicate",
        })
    );
    assert_eq!(
        envelope["warnings"],
        json!([{ "code": "AVAILABLE_ACTIONS", "message": "Available actions: get, set, reset" }])
    );
}
