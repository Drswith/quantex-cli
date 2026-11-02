//! `capabilities` and `doctor`.

use quantex_contract_tests::{Sandbox, assert_envelope, contract_json, fake_agent, seed_cache};
use serde_json::{Value, json};

/// The package managers the catalog installs with.
const INSTALLERS: [&str; 2] = ["bun", "npm"];

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
    assert_eq!(self_data["channel"], "stable");
    assert!(self_data["currentVersion"].is_string());
    assert!(self_data["installSource"].is_string());
    assert!(self_data["outdated"].is_boolean());
    for issue in data["issues"].as_array().unwrap() {
        assert_eq!(issue["severity"], "warning");
        assert!(issue["code"].is_string() && issue["message"].is_string());
        assert!(issue["suggestedCommands"].is_array());
    }
}

/// On the stable channel a prerelease build is newer than the latest release; doctor
/// names the channel instead of listing an older version as the latest.
#[test]
fn doctor_names_the_channel_when_this_build_is_newer() {
    let sandbox = Sandbox::new();
    // The real v1.13.6 manifest, still the latest stable release when 2.x betas shipped.
    let manifest = contract_json("fixtures/release/manifest.json");
    seed_cache(&sandbox, "self:manifest:stable", &manifest.to_string());
    let envelope = sandbox.run(["doctor", "--json"]).json();
    assert_eq!(envelope["data"]["self"]["latestVersion"], "1.13.6", "{envelope}");
    assert_eq!(envelope["data"]["self"]["outdated"], false);
    let run = sandbox.run(["doctor"]);
    assert!(run.stdout.contains("1.13.6 (stable channel; "), "{run:?}");
}
