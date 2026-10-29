//! `uninstall`, against a fake npm.
#![cfg(unix)]

use quantex_contract_tests::{Sandbox, assert_envelope, fake_npm};
use serde_json::{Value, json};

const CODEX_RECORDED: &str = r#"{"installedAgents":{"codex":{"agentName":"codex","installType":"npm","packageName":"@openai/codex"}},"self":{}}"#;

fn sandbox() -> Sandbox {
    let sandbox = Sandbox::new();
    fake_npm(&sandbox);
    sandbox
}

fn run_json(sandbox: &Sandbox, args: &[&str]) -> (i32, Value) {
    let mut full = args.to_vec();
    full.extend_from_slice(&["--json"]);
    let run = sandbox.run(&full);
    (run.code, run.json())
}

#[test]
fn uninstall_removes_the_package_and_the_records() {
    let sandbox = sandbox();
    run_json(&sandbox, &["install", "codex"]);
    let (code, envelope) = run_json(&sandbox, &["uninstall", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    assert_envelope(&envelope, "uninstall");
    assert_eq!(
        envelope["data"],
        json!({ "agent": { "displayName": "Codex CLI", "name": "codex" }, "changed": true })
    );
    assert!(
        sandbox
            .npm_calls()
            .contains(&"npm uninstall -g @openai/codex".to_owned())
    );
    let state = sandbox.read_state().unwrap();
    assert_eq!(state["installedAgents"], json!({}));
    assert_eq!(state["lifecycleReceipts"], json!({}));
}

#[test]
fn uninstall_dry_run_changes_nothing() {
    let sandbox = sandbox();
    run_json(&sandbox, &["install", "codex"]);
    let (code, envelope) = run_json(&sandbox, &["uninstall", "codex", "--dry-run"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(
        envelope["warnings"],
        json!([{ "code": "DRY_RUN", "message": "Dry run: would uninstall Codex CLI." }])
    );
    assert!(!sandbox.npm_calls().iter().any(|call| call.starts_with("npm uninstall")));
}

#[test]
fn unmanaged_agents_are_refused() {
    let (code, envelope) = run_json(&sandbox(), &["uninstall", "codex"]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(envelope["error"]["code"], "UNINSTALL_UNMANAGED");
    assert_eq!(
        envelope["error"]["details"],
        json!({ "canAutoUninstall": false, "displayName": "Codex CLI", "input": "codex", "lifecycle": "unmanaged", "name": "codex" })
    );
    assert_eq!(envelope["data"]["changed"], false);
}

#[test]
fn stale_records_for_an_absent_agent_are_reconciled() {
    let sandbox = sandbox();
    sandbox.write_state(CODEX_RECORDED);
    let (code, envelope) = run_json(&sandbox, &["uninstall", "codex", "--dry-run"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(
        envelope["warnings"][0]["message"],
        "Dry run: would remove the stale record."
    );
    let (code, envelope) = run_json(&sandbox, &["uninstall", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"]["changed"], true);
    assert_eq!(envelope["warnings"][0]["code"], "GHOST_STATE_RECONCILED");
    assert_eq!(sandbox.read_state().unwrap()["installedAgents"], json!({}));
}

#[test]
fn unknown_agents_are_not_found() {
    let (code, envelope) = run_json(&sandbox(), &["uninstall", "nope"]);
    assert_eq!(code, 3, "{envelope}");
    assert_eq!(envelope["error"]["code"], "AGENT_NOT_FOUND");
}
