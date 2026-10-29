//! `update`, against a fake npm and a seeded version cache.
#![cfg(unix)]

use std::fs;

use quantex_contract_tests::{Sandbox, assert_envelope, fake_npm, seed_latest_version};
use serde_json::{Value, json};

const CODEX: &str = "@openai/codex";

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

/// codex installed through Quantex at 0.50.0, with `latest` resolving to `latest`.
fn installed_codex(latest: &str) -> Sandbox {
    let sandbox = sandbox();
    let (code, envelope) = run_json(&sandbox, &["install", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    seed_latest_version(&sandbox, CODEX, latest);
    sandbox
}

fn next_npm_version(sandbox: &Sandbox, version: &str) {
    fs::write(sandbox.root().join("npm-next-version"), version).unwrap();
}

fn hold_lifecycle_lock(sandbox: &Sandbox) {
    let lock = sandbox.quantex_dir().join("locks").join("agent-lifecycle.lock");
    fs::create_dir_all(&lock).unwrap();
    fs::write(
        lock.join("owner.json"),
        json!({ "createdAt": "2026-01-01T00:00:00.000Z", "pid": std::process::id() }).to_string(),
    )
    .unwrap();
}

fn mutations(sandbox: &Sandbox) -> Vec<String> {
    sandbox
        .npm_calls()
        .into_iter()
        .filter(|call| call.starts_with("npm install") || call.starts_with("npm update"))
        .collect()
}

#[test]
fn an_agent_on_the_latest_version_is_up_to_date() {
    let sandbox = installed_codex("0.50.0");
    let (code, envelope) = run_json(&sandbox, &["update", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    assert_envelope(&envelope, "update");
    assert_eq!(envelope["target"], json!({ "kind": "agent", "name": "codex" }));
    assert_eq!(
        envelope["data"],
        json!({
            "results": [{
                "displayName": "Codex CLI",
                "installedVersion": "0.50.0",
                "latestVersion": "0.50.0",
                "name": "codex",
                "status": "up-to-date",
            }],
            "scope": "single",
        })
    );
    assert_eq!(mutations(&sandbox), ["npm install -g @openai/codex"]);
}

#[test]
fn an_outdated_agent_is_updated_and_recorded() {
    let sandbox = installed_codex("0.51.0");
    next_npm_version(&sandbox, "0.51.0");
    let (code, envelope) = run_json(&sandbox, &["update", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(
        envelope["data"]["results"],
        json!([{
            "displayName": "Codex CLI",
            "installedVersion": "0.50.0",
            "latestVersion": "0.51.0",
            "name": "codex",
            "status": "updated",
            "strategy": "managed/npm",
        }])
    );
    assert_eq!(
        mutations(&sandbox),
        ["npm install -g @openai/codex", "npm install -g @openai/codex@latest"]
    );
    let receipt = &sandbox.read_state().unwrap()["lifecycleReceipts"]["codex"];
    assert_eq!(receipt["version"], "0.51.0");
    assert_eq!(receipt["executableName"], "codex");
    assert_eq!(receipt["providerId"], "npm");
}

#[test]
fn respect_semver_uses_npm_update() {
    let sandbox = installed_codex("0.51.0");
    sandbox.write_config(&json!({
        "networkRetries": 0,
        "networkTimeoutMs": 1,
        "npmBunUpdateStrategy": "respect-semver",
    }));
    next_npm_version(&sandbox, "0.51.0");
    let (code, envelope) = run_json(&sandbox, &["update", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(mutations(&sandbox).last().unwrap(), "npm update -g @openai/codex");
}

#[test]
fn an_update_that_does_not_reach_the_target_fails_verification() {
    let sandbox = installed_codex("0.51.0");
    let (code, envelope) = run_json(&sandbox, &["update", "codex"]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(
        envelope["error"],
        json!({ "code": "UPDATE_FAILED", "message": "Failed to update Codex CLI." })
    );
    let result = &envelope["data"]["results"][0];
    assert_eq!(result["status"], "failed");
    assert_eq!(
        result["message"],
        "Observed version 0.50.0 does not satisfy target 0.51.0."
    );
    assert_eq!(
        sandbox.read_state().unwrap()["lifecycleReceipts"]["codex"]["version"],
        "0.50.0"
    );
}

#[test]
fn a_failing_provider_command_fails_the_update() {
    let sandbox = installed_codex("0.51.0");
    fs::write(sandbox.root().join("npm-fail"), "").unwrap();
    let (code, envelope) = run_json(&sandbox, &["update", "codex"]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(envelope["error"]["code"], "UPDATE_FAILED");
    assert_eq!(
        envelope["data"]["results"],
        json!([{
            "displayName": "Codex CLI",
            "installedVersion": "0.50.0",
            "latestVersion": "0.51.0",
            "name": "codex",
            "status": "failed",
            "strategy": "managed/npm",
        }])
    );
}

#[test]
fn dry_run_plans_without_updating() {
    let sandbox = installed_codex("0.51.0");
    let (code, envelope) = run_json(&sandbox, &["update", "codex", "--dry-run"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(
        envelope["data"]["results"],
        json!([{
            "displayName": "Codex CLI",
            "installedVersion": "0.50.0",
            "latestVersion": "0.51.0",
            "message": "Dry run: would update Codex CLI.",
            "name": "codex",
            "status": "planned",
            "strategy": "managed/npm",
        }])
    );
    assert_eq!(mutations(&sandbox), ["npm install -g @openai/codex"]);
}

#[test]
fn a_newer_installed_version_is_left_for_manual_review() {
    let sandbox = installed_codex("0.49.0");
    let (code, envelope) = run_json(&sandbox, &["update", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    let result = &envelope["data"]["results"][0];
    assert_eq!(result["status"], "manual-required");
    assert_eq!(
        result["message"],
        "Codex CLI uses a manually managed install source. Please check for updates manually."
    );
}

#[test]
fn an_unresolvable_latest_version_fails_the_update() {
    let sandbox = sandbox();
    run_json(&sandbox, &["install", "codex"]);
    let (code, envelope) = run_json(&sandbox, &["update", "codex"]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(
        envelope["data"]["results"],
        json!([{
            "displayName": "Codex CLI",
            "installedVersion": "0.50.0",
            "name": "codex",
            "status": "failed",
            "strategy": "npm",
        }])
    );
}

#[test]
fn a_missing_agent_is_not_installed() {
    let (code, envelope) = run_json(&sandbox(), &["update", "codex"]);
    assert_eq!(code, 4, "{envelope}");
    assert_eq!(
        envelope["error"],
        json!({ "code": "AGENT_NOT_INSTALLED", "message": "Codex CLI is not installed." })
    );
    assert!(envelope["data"].is_null());
}

#[test]
fn stale_state_points_at_uninstall() {
    let sandbox = sandbox();
    sandbox.write_state(
        r#"{"installedAgents":{"codex":{"agentName":"codex","installType":"npm","packageName":"@openai/codex"}},"self":{}}"#,
    );
    let (code, envelope) = run_json(&sandbox, &["update", "codex"]);
    assert_eq!(code, 4, "{envelope}");
    assert_eq!(envelope["error"]["code"], "AGENT_NOT_INSTALLED");
    assert_eq!(
        envelope["warnings"],
        json!([{
            "code": "AGENT_STALE_STATE",
            "details": {
                "agentName": "codex",
                "suggestedAction": "reconcile-agent-state",
                "suggestedCommands": ["quantex uninstall codex"],
            },
            "message": "Codex CLI is not installed but has stale lifecycle evidence. Run `quantex uninstall codex` to reconcile it.",
        }])
    );
}

#[test]
fn an_untracked_agent_needs_manual_action() {
    let sandbox = sandbox();
    sandbox.fake_tool("kilo", "echo 1.0.0", "echo 1.0.0");
    let (code, envelope) = run_json(&sandbox, &["update", "kilo"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(
        envelope["data"]["results"],
        json!([{
            "displayName": "Kilo CLI",
            "installedVersion": "1.0.0",
            "message": "Kilo CLI is detected on disk but not tracked as a Quantex-managed install. Use `quantex inspect kilo --json` to confirm the source, then reinstall through Quantex if you want `quantex update --all` to manage it.",
            "name": "kilo",
            "status": "manual-required",
        }])
    );
}

#[test]
fn argument_errors() {
    let sandbox = sandbox();
    let (code, envelope) = run_json(&sandbox, &["update"]);
    assert_eq!(code, 2, "{envelope}");
    assert_eq!(
        envelope["error"],
        json!({ "code": "INVALID_ARGUMENT", "message": "Please specify an agent name or use --all flag" })
    );
    assert_eq!(envelope["target"], json!({ "kind": "agent" }));

    let (code, envelope) = run_json(&sandbox, &["update", "codex", "--managed"]);
    assert_eq!(code, 2, "{envelope}");
    assert_eq!(envelope["error"]["message"], "The --managed option requires --all.");

    let (code, envelope) = run_json(&sandbox, &["update", "nope"]);
    assert_eq!(code, 3, "{envelope}");
    assert_eq!(
        envelope["error"],
        json!({ "code": "AGENT_NOT_FOUND", "details": { "input": "nope" }, "message": "Unknown agent: nope" })
    );
}

#[test]
fn a_held_lifecycle_lock_is_reported() {
    let sandbox = installed_codex("0.51.0");
    next_npm_version(&sandbox, "0.51.0");
    hold_lifecycle_lock(&sandbox);
    let (code, envelope) = run_json(&sandbox, &["update", "codex"]);
    assert_eq!(code, 9, "{envelope}");
    assert_eq!(envelope["error"]["code"], "RESOURCE_LOCKED");
    assert_eq!(envelope["error"]["details"], json!({ "resource": "agent lifecycle" }));
    let result = &envelope["data"]["results"][0];
    assert_eq!(result["status"], "locked");
    assert_eq!(result["resource"], "agent lifecycle");
    assert_eq!(mutations(&sandbox), ["npm install -g @openai/codex"]);
}

#[test]
fn a_superseded_package_is_not_compared_across_the_rename() {
    let sandbox = sandbox();
    sandbox.write_state(
        r#"{"installedAgents":{"pi":{"agentName":"pi","installType":"npm","packageName":"@mariozechner/pi-coding-agent"}},"self":{}}"#,
    );
    fs::write(
        sandbox.root().join("npm-installed.txt"),
        "@mariozechner/pi-coding-agent\n",
    )
    .unwrap();
    sandbox.fake_tool("pi", "echo 0.50.0", "echo 0.50.0");
    let (code, envelope) = run_json(&sandbox, &["update", "pi"]);
    assert_eq!(code, 0, "{envelope}");
    let result = &envelope["data"]["results"][0];
    assert_eq!(result["status"], "manual-required");
    assert_eq!(envelope["warnings"][0]["code"], "AGENT_PACKAGE_SUPERSEDED");
    assert_eq!(envelope["warnings"][0]["message"], result["message"]);
}

/// cursor recorded as a script install whose `agent update` moves it to `after`.
fn self_updating_cursor(after: &str) -> Sandbox {
    let sandbox = sandbox();
    sandbox.write_state(
        r#"{"installedAgents":{"cursor":{"agentName":"cursor","installType":"script","command":"curl https://cursor.com/install -fsS | bash"}},"self":{}}"#,
    );
    let agent = sandbox.bin_dir().join("agent");
    sandbox.fake_tool(
        "agent",
        &format!(
            "if [ \"$1\" = update ]; then printf '#!/bin/sh\\necho {after}\\n' > \"{}\"; exit 0; fi\necho 2025.10.01",
            agent.display()
        ),
        "echo 2025.10.01",
    );
    sandbox
}

#[test]
fn a_script_install_updates_itself() {
    let sandbox = self_updating_cursor("2025.11.01");
    let (code, envelope) = run_json(&sandbox, &["update", "cursor"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(
        envelope["data"]["results"],
        json!([{
            "displayName": "Cursor CLI",
            "installedVersion": "2025.10.01",
            "latestVersion": "2025.11.01",
            "name": "cursor",
            "status": "updated",
            "strategy": "self-update",
        }])
    );
    let receipt = &sandbox.read_state().unwrap()["lifecycleReceipts"]["cursor"];
    assert_eq!(receipt["version"], "2025.11.01");
    assert_eq!(receipt["providerId"], "script");
}

#[test]
fn a_self_update_that_keeps_the_version_is_up_to_date() {
    let sandbox = self_updating_cursor("2025.10.01");
    let (code, envelope) = run_json(&sandbox, &["update", "cursor"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(
        envelope["data"]["results"],
        json!([{
            "displayName": "Cursor CLI",
            "installedVersion": "2025.10.01",
            "name": "cursor",
            "status": "up-to-date",
            "strategy": "self-update",
        }])
    );
}

#[test]
fn batch_update_covers_recorded_and_present_agents() {
    let sandbox = installed_codex("0.51.0");
    next_npm_version(&sandbox, "0.51.0");
    let (code, envelope) = run_json(&sandbox, &["update", "--all"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["ok"], true);
    assert_eq!(envelope["target"], json!({ "kind": "agent" }));
    assert_eq!(envelope["data"]["scope"], "all");
    assert_eq!(
        envelope["data"]["results"],
        json!([{
            "displayName": "Codex CLI",
            "installedVersion": "0.50.0",
            "latestVersion": "0.51.0",
            "name": "codex",
            "status": "updated",
            "strategy": "managed/npm",
        }])
    );
}

#[test]
fn batch_update_failure_reports_update_failed() {
    let sandbox = installed_codex("0.51.0");
    fs::write(sandbox.root().join("npm-fail"), "").unwrap();
    let (code, envelope) = run_json(&sandbox, &["update", "--all"]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(
        envelope["error"],
        json!({ "code": "UPDATE_FAILED", "message": "One or more agents failed to update." })
    );
    assert_eq!(envelope["data"]["results"][0]["status"], "failed");
}

#[test]
fn batch_update_reports_a_held_lock_per_agent() {
    let sandbox = installed_codex("0.51.0");
    hold_lifecycle_lock(&sandbox);
    let (code, envelope) = run_json(&sandbox, &["update", "--all"]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(envelope["error"]["code"], "UPDATE_FAILED");
    let result = &envelope["data"]["results"][0];
    assert_eq!(result["status"], "locked");
    assert_eq!(result["resource"], "agent lifecycle");
}

#[test]
fn managed_batch_skips_stale_state_with_a_warning() {
    let sandbox = sandbox();
    sandbox.write_state(
        r#"{"installedAgents":{"codex":{"agentName":"codex","installType":"npm","packageName":"@openai/codex"}},"self":{}}"#,
    );
    let (code, envelope) = run_json(&sandbox, &["update", "--all", "--managed"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"], json!({ "results": [], "scope": "managed" }));
    assert_eq!(envelope["warnings"][0]["code"], "AGENT_STALE_STATE");
}

#[test]
fn batch_update_with_nothing_installed_is_empty() {
    let (code, envelope) = run_json(&sandbox(), &["update", "--all"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"], json!({ "results": [], "scope": "all" }));
    assert_eq!(envelope["warnings"], json!([]));
}
