//! `capabilities` and `doctor`.

use quantex_contract_tests::{Sandbox, assert_envelope, fake_agent, is_reference};
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
fn capabilities_describe_the_surface() {
    let run = Sandbox::new().run(["capabilities", "--output", "json"]);
    assert_eq!(run.code, 0, "{run:?}");
    let envelope = run.json();
    assert_envelope(&envelope, "capabilities", "json");
    assert_eq!(envelope["target"], json!({ "kind": "system", "name": "capabilities" }));
    let data = &envelope["data"];
    assert_eq!(
        keys(data),
        ["agents", "features", "installers", "outputModes", "platform"]
    );
    assert_eq!(data["outputModes"], json!(["human", "json", "ndjson"]));
    // v1.13.6 lists all 33 agents and nine installers; 2.0.0-beta.2 trimmed both.
    if !is_reference() {
        assert_eq!(data["agents"].as_array().unwrap().len(), 22);
        assert_eq!(keys(&data["installers"]), INSTALLERS);
    }
    for installer in keys(&data["installers"]) {
        let installer = installer.as_str();
        let entry = &data["installers"][installer];
        assert!(entry["available"].is_boolean(), "{installer}: {entry}");
        if entry["available"] == false {
            assert!(
                matches!(entry["reason"].as_str(), Some("not-found" | "not-on-platform")),
                "{installer}: {entry}"
            );
            if !is_reference() {
                assert_eq!(entry["reason"], "not-found", "{installer}: {entry}");
            }
        }
    }
    assert!(matches!(
        data["platform"]["os"].as_str(),
        Some("macos" | "linux" | "windows")
    ));
    assert!(matches!(data["platform"]["arch"].as_str(), Some("arm64" | "x64")));
    let features = &data["features"];
    assert_eq!(features["channels"], json!(["stable", "beta"]));
    assert_eq!(
        features["execInstallPolicies"],
        json!(["never", "if-missing", "always"])
    );
    assert_eq!(
        features["logLevels"],
        json!(["silent", "error", "warn", "info", "debug"])
    );
    for flag in [
        "assumeYes",
        "cacheBypass",
        "cacheRefresh",
        "dryRun",
        "freshnessMetadata",
        "idempotencyKey",
        "quietLogs",
        "timeout",
    ] {
        assert_eq!(features[flag], true, "{flag}");
    }
    assert!(features["selfUpgrade"].is_boolean());
}

#[test]
fn doctor_reports_installers_agents_and_self() {
    let sandbox = Sandbox::new();
    fake_agent(&sandbox, "codex", "codex-cli 0.48.0");
    sandbox.write_state(
        r#"{"installedAgents":{"codex":{"agentName":"codex","installType":"npm","packageName":"@openai/codex"}},"self":{}}"#,
    );
    let run = sandbox.run(["doctor", "--output", "json"]);
    assert_eq!(run.code, 0, "{run:?}");
    let envelope = run.json();
    assert_envelope(&envelope, "doctor", "json");
    assert_eq!(envelope["target"], json!({ "kind": "system", "name": "doctor" }));
    let data = &envelope["data"];
    assert_eq!(keys(data), ["agents", "installers", "issues", "self"]);
    if !is_reference() {
        assert_eq!(keys(&data["installers"]), INSTALLERS);
    }
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
