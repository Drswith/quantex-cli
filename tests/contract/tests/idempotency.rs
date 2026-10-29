//! `--idempotency-key` replay for install, ensure, uninstall, and update.
#![cfg(unix)]

use std::fs;
use std::path::PathBuf;

use quantex_contract_tests::{Sandbox, fake_npm, is_reference, seed_latest_version};
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

fn with_key<'a>(args: &[&'a str], key: &'a str) -> Vec<&'a str> {
    let mut full = args.to_vec();
    full.extend_from_slice(&["--idempotency-key", key]);
    full
}

fn records(sandbox: &Sandbox) -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = fs::read_dir(sandbox.quantex_dir().join("idempotency"))
        .map(|entries| {
            entries
                .filter_map(|entry| entry.ok().map(|entry| entry.path()))
                .collect()
        })
        .unwrap_or_default();
    paths.sort();
    paths
}

fn installs(sandbox: &Sandbox) -> usize {
    sandbox
        .npm_calls()
        .iter()
        .filter(|call| call.starts_with("npm install"))
        .count()
}

/// The envelope without the fields every run renews.
fn stable(envelope: &Value) -> Value {
    let mut envelope = envelope.clone();
    envelope.as_object_mut().unwrap().remove("meta");
    envelope
}

#[test]
fn a_retried_install_replays_the_recorded_result() {
    let sandbox = sandbox();
    let (code, first) = run_json(&sandbox, &with_key(&["install", "codex"], "job-1"));
    assert_eq!(code, 0, "{first}");
    let (code, second) = run_json(&sandbox, &with_key(&["install", "codex"], "job-1"));
    assert_eq!(code, 0, "{second}");
    assert_eq!(stable(&second), stable(&first), "the stored result is replayed");
    assert_eq!(second["data"]["changed"], true);
    assert_ne!(second["meta"]["runId"], first["meta"]["runId"]);
    assert_eq!(installs(&sandbox), 1, "the install does not run again");

    let records = records(&sandbox);
    assert_eq!(records.len(), 1);
    let name = records[0].file_name().unwrap().to_string_lossy().into_owned();
    assert!(name.len() == 69 && name.ends_with(".json"), "{name}");
    let record: Value = serde_json::from_str(&fs::read_to_string(&records[0]).unwrap()).unwrap();
    assert_eq!(record["schemaVersion"], 1);
    assert_eq!(
        record["request"]["payload"],
        json!({ "action": "install", "options": {}, "targets": ["codex"] })
    );
    assert_eq!(
        record["postcondition"]["payload"],
        json!({ "agentTargetId": "codex", "kind": "package-present", "providerId": "npm", "targetId": "@openai/codex" })
    );
    assert_eq!(record["result"]["ok"], true);
}

#[test]
fn a_replay_is_skipped_once_the_agent_is_gone() {
    let sandbox = sandbox();
    run_json(&sandbox, &with_key(&["install", "codex"], "job-1"));
    fs::remove_file(sandbox.bin_dir().join("codex")).unwrap();
    fs::write(sandbox.root().join("npm-installed.txt"), "").unwrap();
    let (code, envelope) = run_json(&sandbox, &with_key(&["install", "codex"], "job-1"));
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(installs(&sandbox), 2, "the install runs again");
}

#[test]
fn a_key_reused_for_another_request_is_refused() {
    let sandbox = sandbox();
    run_json(&sandbox, &with_key(&["install", "codex"], "job-1"));
    let (code, envelope) = run_json(&sandbox, &with_key(&["install", "kilo"], "job-1"));
    assert_eq!(code, 2, "{envelope}");
    assert_eq!(
        envelope["error"],
        json!({
            "code": "INVALID_ARGUMENT",
            "details": { "existingAction": "install", "idempotencyKey": "job-1", "reason": "request-mismatch" },
            "message": "Idempotency key job-1 was already used for a different canonical request.",
        })
    );
    assert_eq!(installs(&sandbox), 1);
}

#[test]
fn distinct_keys_never_share_a_record() {
    let sandbox = sandbox();
    run_json(&sandbox, &with_key(&["install", "codex"], "job-1/install/codex"));
    let (code, envelope) = run_json(&sandbox, &with_key(&["install", "kilo"], "job-1_install_codex"));
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"]["agent"]["name"], "kilo");
    assert_eq!(records(&sandbox).len(), 2);
}

#[test]
fn an_unreadable_record_is_reported() {
    let sandbox = sandbox();
    run_json(&sandbox, &with_key(&["install", "codex"], "job-1"));
    let record = records(&sandbox).remove(0);
    fs::write(&record, "{nope").unwrap();
    let (code, envelope) = run_json(&sandbox, &with_key(&["install", "codex"], "job-1"));
    assert_eq!(code, 2, "{envelope}");
    assert_eq!(
        envelope["error"],
        json!({
            "code": "INVALID_ARGUMENT",
            "details": { "idempotencyKey": "job-1", "invalidReason": "invalid-json", "reason": "invalid-evidence" },
            "message": "Idempotency key job-1 contains invalid replay evidence (invalid-json).",
        })
    );
}

#[test]
fn dry_runs_keep_no_record() {
    let sandbox = sandbox();
    let (code, envelope) = run_json(&sandbox, &with_key(&["install", "codex", "--dry-run"], "job-1"));
    assert_eq!(code, 0, "{envelope}");
    assert!(records(&sandbox).is_empty());
}

#[test]
fn ensure_replays_in_ndjson_mode() {
    let sandbox = sandbox();
    run_json(&sandbox, &with_key(&["ensure", "codex"], "job-1"));
    let run = sandbox.run(with_key(&["ensure", "codex", "--output", "ndjson"], "job-1"));
    assert_eq!(run.code, 0, "{run:?}");
    let events = run.ndjson();
    assert_eq!(events.len(), 1, "a replay emits only its result");
    assert_eq!(events[0]["type"], "result");
    let envelope = &events[0]["data"];
    assert_eq!(envelope["meta"]["mode"], "ndjson");
    assert_eq!(envelope["data"]["changed"], true);
    assert_eq!(installs(&sandbox), 1);
}

#[test]
fn update_replays_once_the_target_version_holds() {
    let sandbox = sandbox();
    run_json(&sandbox, &["install", "codex"]);
    seed_latest_version(&sandbox, "@openai/codex", "0.51.0");
    fs::write(sandbox.root().join("npm-next-version"), "0.51.0").unwrap();
    let (code, updated) = run_json(&sandbox, &with_key(&["update", "codex"], "job-1"));
    assert_eq!(code, 0, "{updated}");
    assert_eq!(updated["data"]["results"][0]["status"], "updated");
    // The plan changed (nothing left to upgrade), so the retry reconciles...
    let (code, reconciled) = run_json(&sandbox, &with_key(&["update", "codex"], "job-1"));
    assert_eq!(code, 0, "{reconciled}");
    assert_eq!(reconciled["data"]["results"][0]["status"], "up-to-date");
    // ...and records that, which the next retry replays.
    let (code, replayed) = run_json(&sandbox, &with_key(&["update", "codex"], "job-1"));
    assert_eq!(code, 0, "{replayed}");
    assert_eq!(stable(&replayed), stable(&reconciled));
    let record: Value = serde_json::from_str(&fs::read_to_string(records(&sandbox).remove(0)).unwrap()).unwrap();
    assert_eq!(
        record["request"]["payload"],
        json!({ "action": "update", "options": { "requestedVersion": "latest", "scope": "single" }, "targets": ["codex"] })
    );
    assert_eq!(record["postcondition"]["payload"]["kind"], "version-satisfies");
    assert_eq!(record["postcondition"]["payload"]["expectedVersion"], "0.51.0");
}

#[test]
fn uninstall_replays_while_the_agent_stays_removed() {
    // v1 never replayed uninstall: a missing package manager made the check inconclusive.
    if is_reference() {
        return;
    }
    let sandbox = sandbox();
    run_json(&sandbox, &["install", "codex"]);
    let (code, first) = run_json(&sandbox, &with_key(&["uninstall", "codex"], "job-1"));
    assert_eq!(code, 0, "{first}");
    let (code, second) = run_json(&sandbox, &with_key(&["uninstall", "codex"], "job-1"));
    assert_eq!(code, 0, "{second}");
    assert_eq!(stable(&second), stable(&first));
}

#[test]
fn batch_install_records_and_replays() {
    // v1 printed the result, then failed to write its own record and exited 1.
    if is_reference() {
        return;
    }
    let sandbox = sandbox();
    let (code, first) = run_json(&sandbox, &with_key(&["install", "codex", "kilo"], "job-1"));
    assert_eq!(code, 0, "{first}");
    let (code, second) = run_json(&sandbox, &with_key(&["install", "kilo", "codex"], "job-1"));
    assert_eq!(code, 0, "{second}");
    assert_eq!(stable(&second), stable(&first));
    assert_eq!(installs(&sandbox), 2);
}

#[test]
fn an_empty_batch_update_with_a_key_succeeds() {
    // v1 failed to build evidence for an empty batch and exited 1.
    if is_reference() {
        return;
    }
    let (code, envelope) = run_json(&sandbox(), &with_key(&["update", "--all"], "job-1"));
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"], json!({ "results": [], "scope": "all" }));
}
