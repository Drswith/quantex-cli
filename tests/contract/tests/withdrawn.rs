//! What 2.0.0-beta.2 removed: agents, providers, options, and commands.

use quantex_contract_tests::Sandbox;
use serde_json::json;

#[test]
fn withdrawn_agents_are_unknown() {
    let sandbox = Sandbox::new();
    for agent in ["gemini", "qwen", "reasonix"] {
        let run = sandbox.run(["info", agent, "--json"]);
        assert_eq!(run.code, 3, "{agent}: {run:?}");
        assert_eq!(run.json()["error"]["code"], "AGENT_NOT_FOUND", "{agent}: {run:?}");
    }
}

#[test]
fn records_from_removed_providers_are_kept() {
    let sandbox = Sandbox::new();
    let record = json!({ "agentName": "openhands", "installType": "uv", "packageName": "openhands" });
    let state = json!({
        "installedAgents": { "openhands": record },
        "lifecycleReceipts": {},
        "schemaVersion": 2,
        "self": {},
    });
    sandbox.write_state(&state.to_string());
    let run = sandbox.run(["list", "--json"]);
    assert_eq!(run.code, 0, "{run:?}");
    // `upgrade` records the detected install source, which rewrites state.json.
    sandbox.run(["upgrade", "--check", "--json"]);
    let state = sandbox.read_state().unwrap();
    assert!(
        state["self"]["installSource"].is_string(),
        "state was rewritten: {state}"
    );
    assert_eq!(state["installedAgents"]["openhands"], record);
}

#[test]
fn removed_options_are_invalid_arguments() {
    let sandbox = Sandbox::new();
    for args in [
        &["list", "--output", "json"][..],
        &["list", "--log-level", "info", "--json"],
        &["install", "codex", "--idempotency-key", "k1", "--json"],
    ] {
        let run = sandbox.run(args);
        assert_eq!(run.code, 2, "{args:?}: {run:?}");
        if args.contains(&"--json") {
            assert_eq!(run.json()["error"]["code"], "INVALID_ARGUMENT", "{args:?}: {run:?}");
        }
    }
}

#[test]
fn removed_commands_are_unknown() {
    let sandbox = Sandbox::new();
    for command in ["capabilities", "schema"] {
        let run = sandbox.run([command, "--json"]);
        assert_eq!(run.code, 2, "{command}: {run:?}");
        let envelope = run.json();
        assert_eq!(envelope["error"]["code"], "INVALID_ARGUMENT", "{command}: {envelope}");
        assert_eq!(
            envelope["error"]["details"]["reason"], "unknown-command",
            "{command}: {envelope}"
        );
    }
}
