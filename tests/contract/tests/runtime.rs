//! Deadlines: `--timeout` cancels a command that does not finish in time.

use quantex_contract_tests::{Sandbox, assert_envelope};
use serde_json::json;

fn slow_sandbox() -> Sandbox {
    let sandbox = Sandbox::new();
    sandbox.fake_tool("codex", "sleep 10", "ping -n 11 127.0.0.1 > nul");
    sandbox
}

#[test]
fn timeout_reports_timeout_in_json() {
    let started = std::time::Instant::now();
    let run = slow_sandbox().run(["list", "--timeout", "300ms", "--json"]);
    assert!(started.elapsed().as_secs() < 8, "the deadline is enforced");
    assert_eq!(run.code, 10, "{run:?}");
    let envelope = run.json();
    assert_envelope(&envelope, "list");
    assert_eq!(
        envelope["error"],
        json!({
            "code": "TIMEOUT",
            "details": { "timeoutMs": 300 },
            "message": "Command timed out after 300ms.",
        })
    );
}
