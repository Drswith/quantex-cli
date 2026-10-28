//! `install` and `ensure`, against a fake npm.
#![cfg(unix)]

use quantex_contract_tests::{Sandbox, assert_envelope, fake_npm};
use serde_json::{Value, json};

fn sandbox() -> Sandbox {
    let sandbox = Sandbox::new();
    fake_npm(&sandbox);
    sandbox
}

fn run_json(sandbox: &Sandbox, args: &[&str]) -> (i32, Value) {
    let mut full = args.to_vec();
    full.extend_from_slice(&["--output", "json"]);
    let run = sandbox.run(&full);
    (run.code, run.json())
}

#[test]
fn install_records_state_and_a_receipt() {
    let sandbox = sandbox();
    let (code, envelope) = run_json(&sandbox, &["install", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    assert_envelope(&envelope, "install", "json");
    assert_eq!(
        envelope["data"],
        json!({
            "agent": { "displayName": "Codex CLI", "name": "codex" },
            "changed": true,
            "installState": { "installType": "npm", "packageName": "@openai/codex" },
            "installed": true,
        })
    );
    assert!(sandbox.npm_calls().contains(&"npm install -g @openai/codex".to_owned()));
    let state = sandbox.read_state().unwrap();
    assert_eq!(state["schemaVersion"], 2);
    assert_eq!(
        state["installedAgents"]["codex"],
        json!({ "agentName": "codex", "installType": "npm", "packageName": "@openai/codex" })
    );
    let receipt = &state["lifecycleReceipts"]["codex"];
    assert_eq!(receipt["kind"], "lifecycle-receipt");
    assert_eq!(receipt["providerId"], "npm");
    assert_eq!(receipt["providerTargetId"], "@openai/codex");
    assert_eq!(receipt["providerTargetKind"], "package");
    assert_eq!(receipt["schemaVersion"], 1);
    assert_eq!(receipt["targetId"], "codex");
    assert_eq!(receipt["version"], "0.50.0");
    assert!(receipt["verifiedAt"].is_string());
    assert!(receipt["executablePath"].as_str().unwrap().ends_with("/bin/codex"));
}

#[test]
fn installing_twice_reports_already_installed() {
    let sandbox = sandbox();
    run_json(&sandbox, &["install", "codex"]);
    let (code, envelope) = run_json(&sandbox, &["install", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"]["changed"], false);
    assert_eq!(envelope["data"]["installed"], true);
    assert_eq!(
        envelope["warnings"],
        json!([{ "code": "ALREADY_INSTALLED", "message": "Codex CLI is already installed." }])
    );
}

#[test]
fn dry_run_plans_without_changing_anything() {
    let sandbox = sandbox();
    let (code, envelope) = run_json(&sandbox, &["install", "codex", "--dry-run"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"]["changed"], false);
    assert_eq!(envelope["data"]["installed"], false);
    assert_eq!(
        envelope["warnings"],
        json!([{ "code": "DRY_RUN", "message": "Dry run: would install Codex CLI." }])
    );
    assert!(!sandbox.npm_calls().iter().any(|call| call.starts_with("npm install")));
    assert!(sandbox.read_state().is_none());
}

#[test]
fn ensure_installs_like_install() {
    let sandbox = sandbox();
    let (code, envelope) = run_json(&sandbox, &["ensure", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    assert_envelope(&envelope, "ensure", "json");
    assert_eq!(envelope["data"]["changed"], true);
    let (_, envelope) = run_json(&sandbox, &["ensure", "codex"]);
    assert_eq!(envelope["warnings"][0]["code"], "ALREADY_INSTALLED");
}

#[test]
fn an_unattributable_existing_executable_stays_unmanaged() {
    let sandbox = sandbox();
    sandbox.fake_tool("gemini", "echo 1.0.0", "echo 1.0.0");
    let (code, envelope) = run_json(&sandbox, &["install", "gemini"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(
        envelope["data"],
        json!({ "agent": { "displayName": "Gemini CLI", "name": "gemini" }, "changed": false, "installed": true })
    );
    assert_eq!(envelope["warnings"][0]["code"], "UNTRACKED_EXISTING_INSTALL");
    assert!(sandbox.read_state().is_none());
}

#[test]
fn no_available_provider_is_reported_with_the_reasons() {
    let sandbox = Sandbox::new();
    let (code, envelope) = run_json(&sandbox, &["install", "codex"]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(envelope["error"]["code"], "INSTALL_FAILED");
    assert_eq!(envelope["error"]["details"]["lifecycle"], "provider-unavailable");
    let reason = envelope["error"]["details"]["reason"].as_str().unwrap();
    assert!(
        reason.starts_with("No installation provider is currently available: "),
        "{reason}"
    );
    assert!(reason.contains("npm: npm executable is unavailable"), "{reason}");
    assert_eq!(envelope["data"]["installed"], false);
}

#[test]
fn a_failing_installer_is_install_failed() {
    let sandbox = sandbox();
    std::fs::write(sandbox.root().join("npm-fail"), "").unwrap();
    let (code, envelope) = run_json(&sandbox, &["install", "codex"]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(envelope["error"]["code"], "INSTALL_FAILED");
    assert_eq!(
        envelope["error"]["message"],
        "Failed to install Codex CLI: npm install failed with exit code 1"
    );
    assert!(sandbox.read_state().is_none());
}

#[test]
fn a_recorded_but_missing_agent_is_reinstalled_from_its_source() {
    let sandbox = sandbox();
    sandbox.write_state(
        r#"{"installedAgents":{"codex":{"agentName":"codex","installType":"npm","packageName":"@openai/codex"}},"self":{}}"#,
    );
    let (code, envelope) = run_json(&sandbox, &["install", "codex", "--dry-run"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(
        envelope["warnings"][0]["message"],
        "Dry run: would reinstall Codex CLI only if its recorded provider target is confirmed absent."
    );
    let (code, envelope) = run_json(&sandbox, &["install", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"]["changed"], true);
}

#[test]
fn batch_install_summarises_every_target() {
    let sandbox = sandbox();
    let (code, envelope) = run_json(&sandbox, &["install", "gemini", "codex", "nope", "codex"]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(envelope["target"], json!({ "kind": "agent" }));
    let data = &envelope["data"];
    assert_eq!(data["scope"], "batch");
    let inputs: Vec<&str> = data["results"]
        .as_array()
        .unwrap()
        .iter()
        .map(|r| r["input"].as_str().unwrap())
        .collect();
    assert_eq!(
        inputs,
        ["codex", "gemini", "nope"],
        "targets are deduplicated and sorted"
    );
    assert_eq!(
        data["summary"],
        json!({ "alreadyInstalled": 0, "failed": 1, "installed": 2, "locked": 0, "planned": 0, "trackedExistingInstall": 0, "untrackedExistingInstall": 0 })
    );
    assert_eq!(
        envelope["error"],
        json!({ "code": "INSTALL_FAILED", "details": { "failedAgents": ["nope"] }, "message": "One or more agents failed to install." })
    );
}

#[test]
fn a_held_lifecycle_lock_is_resource_locked() {
    let sandbox = sandbox();
    let lock = sandbox.quantex_dir().join("locks/agent-lifecycle.lock");
    std::fs::create_dir_all(&lock).unwrap();
    std::fs::write(lock.join("owner.json"), format!("{{\"pid\":{}}}", std::process::id())).unwrap();
    let (code, envelope) = run_json(&sandbox, &["install", "codex"]);
    assert_eq!(code, 9, "{envelope}");
    assert_eq!(envelope["error"]["code"], "RESOURCE_LOCKED");
    assert_eq!(envelope["error"]["details"]["resource"], "agent lifecycle");
}
