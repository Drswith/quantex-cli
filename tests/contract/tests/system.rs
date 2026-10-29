//! `capabilities` and `doctor`.

use quantex_contract_tests::{Sandbox, assert_envelope, fake_agent};
use serde_json::{Value, json};

/// The package managers the catalog installs with on this platform.
const INSTALLERS: [&str; 3] = if cfg!(windows) {
    ["bun", "npm", "winget"]
} else {
    ["brew", "bun", "npm"]
};

fn keys(value: &Value) -> Vec<String> {
    let mut keys: Vec<String> = value.as_object().unwrap().keys().cloned().collect();
    keys.sort();
    keys
}

#[test]
fn doctor_reports_installers_agents_and_self() {
    let sandbox = Sandbox::new();
    fake_agent(&sandbox, "codex", "codex-cli 0.48.0");
    sandbox.write_state(
        r#"{"installedAgents":{"codex":{"agentName":"codex","installType":"npm","packageName":"@openai/codex"}},"self":{}}"#,
    );
    let run = sandbox.run(["doctor", "--json"]);
    assert_eq!(run.code, 0, "{run:?}");
    let envelope = run.json();
    assert_envelope(&envelope, "doctor");
    assert_eq!(envelope["target"], json!({ "kind": "system", "name": "doctor" }));
    let data = &envelope["data"];
    assert_eq!(keys(data), ["agents", "installers", "issues", "self"]);
    assert_eq!(keys(&data["installers"]), INSTALLERS);
    assert_eq!(
        data["agents"],
        json!([{
            "displayName": "Codex CLI",
            "installedVersion": "0.48.0",
            "lifecycle": "managed",
            "outdated": false,
            "sourceLabel": "managed via npm (@openai/codex)",
        }])
    );
    let self_data = &data["self"];
    assert!(self_data["canAutoUpdate"].is_boolean());
    assert!(self_data["currentVersion"].is_string());
    assert!(self_data["installSource"].is_string());
    assert!(self_data["outdated"].is_boolean());
    for issue in data["issues"].as_array().unwrap() {
        assert_eq!(issue["severity"], "warning");
        assert!(issue["code"].is_string() && issue["message"].is_string());
        assert!(issue["suggestedCommands"].is_array());
    }
}
