//! `exec` and the bare-agent shortcut.

use std::fs;

use quantex_contract_tests::{Sandbox, assert_envelope, is_reference};
use serde_json::json;

/// A fake `codex` that records its arguments and exits with status 5.
fn recording_agent() -> (Sandbox, std::path::PathBuf) {
    let mut sandbox = Sandbox::new();
    let record = sandbox.home().join("args.txt");
    sandbox.env("QX_ARGS_FILE", &record.to_string_lossy());
    sandbox.fake_tool(
        "codex",
        "[ \"$1\" = --version ] && { echo 0.48.0; exit 0; }\nprintf '%s\\n' \"$@\" > \"$QX_ARGS_FILE\"\nexit 5",
        "if \"%1\"==\"--version\" (echo 0.48.0& exit /b 0)\r\necho %* > \"%QX_ARGS_FILE%\"\r\nexit /b 5",
    );
    (sandbox, record)
}

fn recorded(path: &std::path::Path) -> Vec<String> {
    fs::read_to_string(path)
        .unwrap_or_default()
        .split_whitespace()
        .map(str::to_owned)
        .collect()
}

#[test]
fn exec_passes_arguments_and_returns_the_agent_exit_code() {
    let (sandbox, record) = recording_agent();
    let run = sandbox.run(["exec", "codex", "-p", "hi", "--", "--yes"]);
    assert_eq!(run.code, 5, "{run:?}");
    // As in v1 (commander): a `--` after an unknown option is passed through.
    assert_eq!(recorded(&record), ["-p", "hi", "--", "--yes"]);
}

#[test]
fn exec_in_json_mode_keeps_stdout_for_the_protocol() {
    let (sandbox, record) = recording_agent();
    let run = sandbox.run(["exec", "codex", "--output", "json", "--", "a"]);
    assert_eq!(run.code, 5, "{run:?}");
    assert_eq!(run.stdout, "", "a launched agent's output is not mixed into stdout");
    assert_eq!(recorded(&record), ["a"]);
}

#[test]
fn exec_in_json_mode_moves_the_agent_output_to_stderr() {
    let sandbox = Sandbox::new();
    sandbox.fake_tool(
        "codex",
        "[ \"$1\" = --version ] && { echo 0.48.0; exit 0; }\necho agent-out\necho agent-err >&2\nexit 3",
        "if \"%1\"==\"--version\" (echo 0.48.0& exit /b 0)\r\necho agent-out\r\necho agent-err 1>&2\r\nexit /b 3",
    );
    let run = sandbox.run(["exec", "codex", "--output", "json"]);
    assert_eq!(run.code, 3, "{run:?}");
    assert_eq!(run.stdout, "");
    let out = run.stderr.find("agent-out").expect("the agent's stdout reaches stderr");
    let err = run.stderr.find("agent-err").expect("the agent's stderr reaches stderr");
    assert!(out < err, "stdout is written before stderr: {run:?}");
}

#[test]
fn exec_dry_run_describes_the_launch() {
    let (sandbox, record) = recording_agent();
    let run = sandbox.run(["exec", "codex", "--dry-run", "--output", "json", "--", "a", "b"]);
    assert_eq!(run.code, 0, "{run:?}");
    assert!(!record.exists(), "dry run does not launch");
    let envelope = run.json();
    assert_envelope(&envelope, "exec", "json");
    assert_eq!(envelope["target"], json!({ "kind": "agent", "name": "codex" }));
    let agent = &envelope["data"]["agent"];
    assert_eq!(agent["name"], "codex");
    assert_eq!(agent["homepage"], "https://developers.openai.com/codex/cli");
    assert_eq!(agent["packages"], json!({ "npm": "@openai/codex" }));
    let execution = &envelope["data"]["execution"];
    assert_eq!(execution["args"], json!(["a", "b"]));
    assert_eq!(execution["installPolicy"], "never");
    assert_eq!(execution["installed"], true);
    assert_eq!(execution["launched"], false);
    assert!(execution["interactive"].is_boolean());
}

#[test]
fn exec_refuses_a_missing_agent_by_default() {
    let run = Sandbox::new().run(["exec", "kilo", "--output", "json", "--", "x"]);
    assert_eq!(run.code, 4, "{run:?}");
    let envelope = run.json();
    assert_envelope(&envelope, "exec", "json");
    assert_eq!(envelope["error"]["code"], "AGENT_NOT_INSTALLED");
    assert_eq!(envelope["error"]["message"], "Kilo CLI is not installed.");
    let guidance = &envelope["error"]["details"];
    assert_eq!(guidance["suggestedAction"], "rerun-with-install-policy");
    assert_eq!(guidance["suggestedEnsureCommand"], "quantex ensure kilo");
    assert_eq!(
        guidance["suggestedExecCommand"],
        "quantex exec kilo --install if-missing -- x"
    );
    assert_eq!(envelope["data"]["execution"]["installGuidance"], *guidance);
    assert_eq!(envelope["data"]["execution"]["installed"], false);
    assert_eq!(envelope["data"]["agent"]["name"], "kilo");
}

#[test]
fn exec_reports_unknown_agents() {
    let run = Sandbox::new().run(["exec", "not-an-agent", "--output", "json"]);
    assert_eq!(run.code, 3, "{run:?}");
    let envelope = run.json();
    assert_eq!(
        envelope["error"],
        json!({ "code": "AGENT_NOT_FOUND", "message": "Unknown agent: not-an-agent" })
    );
    assert_eq!(envelope["data"]["agent"], json!({ "name": "not-an-agent" }));
}

#[test]
fn exec_rejects_an_unknown_install_policy() {
    let run = Sandbox::new().run(["exec", "codex", "--install", "sometimes"]);
    assert_eq!(run.code, 2, "{run:?}");
}

#[test]
fn shortcut_launches_known_agents() {
    let (sandbox, record) = recording_agent();
    let run = sandbox.run(["codex", "resume", "--last"]);
    assert_eq!(run.code, 5, "{run:?}");
    assert_eq!(recorded(&record), ["resume", "--last"]);
}

#[test]
fn shortcut_rejects_structured_output() {
    let (sandbox, record) = recording_agent();
    let run = sandbox.run(["--json", "codex"]);
    assert_eq!(run.code, 2, "{run:?}");
    assert!(!record.exists());
    if !is_reference() {
        let envelope = run.json();
        assert_eq!(envelope["error"]["code"], "INVALID_ARGUMENT");
    }
}

#[test]
fn shortcut_without_a_terminal_does_not_prompt_for_a_missing_agent() {
    // v1 tried to prompt even with no terminal and treated the closed stdin as "no".
    if is_reference() {
        return;
    }
    let run = Sandbox::new().run(["kilo"]);
    assert_eq!(run.code, 7, "{run:?}");
}

#[test]
fn exec_timeout_stops_the_agent() {
    // v1 reported a launch timeout as a generic failure with exit code 1.
    if is_reference() {
        return;
    }
    let sandbox = Sandbox::new();
    sandbox.fake_tool(
        "codex",
        "[ \"$1\" = --version ] && { echo 0.48.0; exit 0; }\nsleep 10",
        "if \"%1\"==\"--version\" (echo 0.48.0& exit /b 0)\r\nping -n 11 127.0.0.1 > nul",
    );
    let started = std::time::Instant::now();
    let run = sandbox.run(["exec", "codex", "--timeout", "300ms", "--output", "json"]);
    assert_eq!(run.code, 10, "{run:?}");
    assert!(
        started.elapsed().as_secs() < 8,
        "the agent and its children are stopped"
    );
}

#[test]
fn a_timeout_during_preflight_is_a_timeout() {
    // v1 reported a hung version probe as INSTALL_FAILED with exit code 1.
    if is_reference() {
        return;
    }
    let sandbox = Sandbox::new();
    sandbox.fake_tool("codex", "sleep 10", "ping -n 11 127.0.0.1 > nul");
    let run = sandbox.run(["exec", "codex", "--timeout", "300ms", "--output", "json"]);
    assert_eq!(run.code, 10, "{run:?}");
}
