//! Self-updater failures must remain failures, including in a mixed batch.

use quantex_contract_tests::Sandbox;

#[test]
fn untracked_script_guidance_adopts_the_existing_install_before_updating() {
    let sandbox = Sandbox::new();
    sandbox.fake_tool(
        "agy",
        "if [ \"$1\" = update ]; then echo fake-self-update >&2; exit 0; fi\necho 1.5.13",
        "if \"%~1\"==\"update\" (\r\n echo fake-self-update 1>&2\r\n exit /b 0\r\n)\r\necho 1.5.13",
    );
    let run = sandbox.run(["update", "antigravity", "--json"]);
    assert_eq!(run.code, 0, "{run:?}");
    let result = &run.json()["data"]["results"][0];
    assert_eq!(result["status"], "manual-required");
    assert!(
        result["message"]
            .as_str()
            .unwrap()
            .contains("quantex install antigravity")
    );
    assert!(!run.stderr.contains("fake-self-update"));
    let doctor = sandbox.run(["doctor", "--json"]).json();
    let issue = doctor["data"]["issues"]
        .as_array()
        .unwrap()
        .iter()
        .find(|issue| issue["code"] == "AGENT_UNTRACKED_IN_PATH")
        .unwrap();
    assert!(issue["message"].as_str().unwrap().contains("without reinstalling"));
    assert_eq!(
        issue["suggestedCommands"],
        serde_json::json!(["quantex info antigravity --json", "quantex install antigravity"])
    );

    let plan = sandbox.run(["install", "antigravity", "--dry-run", "--json"]);
    assert_eq!(plan.code, 0, "{plan:?}");
    assert!(
        plan.json()["warnings"][0]["message"]
            .as_str()
            .unwrap()
            .contains("would record the existing")
    );
    assert!(sandbox.read_state().is_none());
    let install = sandbox.run(["install", "antigravity", "--json"]);
    assert_eq!(install.code, 0, "{install:?}");
    assert_eq!(
        sandbox.read_state().unwrap()["installedAgents"]["antigravity"]["installType"],
        "script"
    );
    let update = sandbox.run(["update", "antigravity", "--json"]);
    assert_eq!(update.code, 0, "{update:?}");
    assert_eq!(update.json()["data"]["results"][0]["status"], "up-to-date");
    assert!(update.stderr.contains("fake-self-update"), "{update:?}");
}

fn cursor_install() -> Sandbox {
    let sandbox = Sandbox::new();
    sandbox.write_state(r#"{"installedAgents":{"cursor":{"agentName":"cursor","installType":"script"}},"self":{}}"#);
    sandbox.fake_tool(
        "agent",
        "if [ \"$1\" = update ]; then echo '[unauthenticated]' >&2; exit 1; fi\necho 2025.10.01",
        "if \"%~1\"==\"update\" (\r\n echo [unauthenticated] 1>&2\r\n exit /b 1\r\n)\r\necho 2025.10.01",
    );
    sandbox
}

#[test]
fn a_failed_self_update_with_an_unchanged_install_is_still_a_failure() {
    let sandbox = cursor_install();
    let before = sandbox.read_state();
    let run = sandbox.run(["update", "cursor", "--json"]);
    let envelope = run.json();
    assert_eq!(run.code, 1, "{run:?}");
    assert_eq!(envelope["ok"], false);
    assert_eq!(envelope["error"]["code"], "UPDATE_FAILED");
    assert_eq!(envelope["data"]["results"][0]["status"], "failed");
    assert!(run.stderr.contains("[unauthenticated]"), "{run:?}");
    assert_eq!(sandbox.read_state(), before);
    let info = sandbox.run(["info", "cursor", "--json"]).json();
    assert_eq!(info["data"]["inspection"]["installedVersion"], "2025.10.01");
}

#[test]
fn a_failed_self_update_that_removes_the_install_is_still_a_failure() {
    let sandbox = cursor_install();
    sandbox.fake_tool(
        "agent",
        "if [ \"$1\" = update ]; then rm -f \"$0\"; exit 1; fi\necho 2025.10.01",
        "if \"%~1\"==\"update\" (\r\n del \"%~f0\"\r\n exit /b 1\r\n)\r\necho 2025.10.01",
    );
    let run = sandbox.run(["update", "cursor", "--json"]);
    let envelope = run.json();
    assert_eq!(run.code, 1, "{run:?}");
    assert_eq!(envelope["error"]["code"], "UPDATE_FAILED");
    assert_eq!(envelope["data"]["results"][0]["status"], "failed");
    let info = sandbox.run(["info", "cursor", "--json"]).json();
    assert_eq!(info["data"]["inspection"]["installed"], false);
}

#[test]
fn batch_update_continues_after_a_failed_self_updater_and_reports_both_results() {
    let sandbox = cursor_install();
    sandbox.write_state(
        r#"{"installedAgents":{"cursor":{"agentName":"cursor","installType":"script"},"grok":{"agentName":"grok","installType":"script"}},"self":{}}"#,
    );
    sandbox.fake_tool(
        "grok",
        "if [ \"$1\" = update ]; then echo 1.1.0 > \"$HOME/grok-version\"; exit 0; fi\ncat \"$HOME/grok-version\" 2>/dev/null || echo 1.0.0",
        "if \"%~1\"==\"update\" (\r\n echo 1.1.0>\"%USERPROFILE%\\grok-version\"\r\n exit /b 0\r\n)\r\nif exist \"%USERPROFILE%\\grok-version\" (type \"%USERPROFILE%\\grok-version\") else (echo 1.0.0)",
    );
    let run = sandbox.run(["update", "--all", "--json"]);
    let envelope = run.json();
    assert_eq!(run.code, 1, "{run:?}");
    assert_eq!(envelope["ok"], false);
    assert_eq!(envelope["error"]["code"], "UPDATE_FAILED");
    let results = envelope["data"]["results"].as_array().unwrap();
    assert_eq!(results.len(), 2, "{envelope}");
    assert_eq!(results[0]["name"], "cursor");
    assert_eq!(results[0]["status"], "failed");
    assert_eq!(results[1]["name"], "grok");
    assert_eq!(results[1]["status"], "updated");
    assert_eq!(results[1]["latestVersion"], "1.1.0");
    assert!(run.stderr.contains("[unauthenticated]"), "{run:?}");
}
