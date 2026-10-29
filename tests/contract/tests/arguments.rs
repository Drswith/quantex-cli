//! Argument errors report `INVALID_ARGUMENT` with exit code 2.
//!
//! v1.13.6 printed a plain stderr line and exited 1 for parse errors.

use quantex_contract_tests::{Sandbox, assert_envelope};

fn assert_invalid_argument(args: &[&str], action: &str) {
    let run = Sandbox::new().run(args);
    assert_eq!(run.code, 2, "{args:?}: {run:?}");
    let envelope = run.json();
    assert_envelope(&envelope, action);
    assert_eq!(envelope["ok"], false);
    assert_eq!(envelope["error"]["code"], "INVALID_ARGUMENT", "{envelope}");
}

#[test]
fn unknown_option_is_an_invalid_argument() {
    assert_invalid_argument(&["list", "--bogus", "--json"], "list");
}

#[test]
fn missing_required_argument_is_an_invalid_argument() {
    assert_invalid_argument(&["info", "--json"], "info");
}

#[test]
fn invalid_global_option_values_are_invalid_arguments() {
    assert_invalid_argument(&["commands", "--color", "rainbow", "--json"], "commands");
    assert_invalid_argument(&["commands", "--timeout", "soon", "--json"], "commands");
}

#[test]
fn unknown_command_is_an_invalid_argument() {
    assert_invalid_argument(&["definitely-not-a-command", "--json"], "quantex");
}

#[test]
fn argument_errors_go_to_stderr_in_human_mode() {
    let run = Sandbox::new().run(["list", "--bogus"]);
    assert_eq!(run.code, 2, "{run:?}");
    assert_eq!(run.stdout, "");
    assert!(run.stderr.contains("--bogus"), "{run:?}");
}
