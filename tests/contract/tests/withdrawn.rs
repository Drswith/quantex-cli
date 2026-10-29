//! Agents and providers removed in 2.0.0-beta.2.

use quantex_contract_tests::{Sandbox, is_reference};
use serde_json::json;

#[test]
fn withdrawn_agents_are_unknown() {
    // v1.13.6 still ships them.
    if is_reference() {
        return;
    }
    let sandbox = Sandbox::new();
    for agent in ["gemini", "qwen", "reasonix"] {
        let run = sandbox.run(["info", agent, "--output", "json"]);
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
    let run = sandbox.run(["list", "--output", "json"]);
    assert_eq!(run.code, 0, "{run:?}");
    // `upgrade` records the detected install source, which rewrites state.json.
    sandbox.run(["upgrade", "--check", "--output", "json"]);
    let state = sandbox.read_state().unwrap();
    assert!(
        state["self"]["installSource"].is_string(),
        "state was rewritten: {state}"
    );
    assert_eq!(state["installedAgents"]["openhands"], record);
}
