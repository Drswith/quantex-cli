//! Devin uses its pinned official installer without the final login wizard.

use quantex_contract_tests::{HttpStub, Sandbox};
use serde_json::json;

fn release(version: &str, reports: &str, changed_layout: bool) -> (Sandbox, HttpStub) {
    let mut sandbox = Sandbox::new();
    let script = if cfg!(windows) {
        format!(
            "$PinnedVersion = \"{version}\"\n$ErrorActionPreference = 'Stop'\n$bin = Join-Path (Split-Path $env:HOME) 'bin'\nSet-Content -LiteralPath (Join-Path $bin 'devin.cmd') -Value '@echo off', 'echo {reports}'\nSet-Content -LiteralPath (Join-Path (Split-Path $bin) 'distribution') -Value 'irm-iex'\n& $EntryExe setup\n"
        )
    } else {
        format!(
            "#!/bin/bash\nset -eu\nPINNED_VERSION=\"{version}\"\nbin=\"$HOME/../bin\"\nprintf '#!/bin/sh\\necho {reports}\\n' > \"$bin/devin\"\nchmod +x \"$bin/devin\"\necho curl-bash > \"$bin/../distribution\"\n\"$VERSION_DIR/bin/$COMPILED_BIN_NAME\" setup\n"
        )
    };
    let script = if changed_layout {
        format!("{script}exit 0\n")
    } else {
        script
    };
    let extension = if cfg!(windows) { "ps1" } else { "sh" };
    let stub = HttpStub::serve(vec![
        (
            "/current/manifest.json".into(),
            200,
            json!({"version": version}).to_string().into_bytes(),
        ),
        (format!("/{version}/setup.{extension}"), 200, script.into_bytes()),
    ]);
    sandbox.env("QUANTEX_DEVIN_BASE_URL", stub.url());
    (sandbox, stub)
}

fn existing(sandbox: &Sandbox, version: &str, distribution: &str) {
    sandbox.fake_tool(
        "devin",
        &format!("if [ \"$1\" = update ]; then exit 130; fi\necho {version}"),
        &format!("if \"%~1\"==\"update\" exit /b 130\r\necho {version}"),
    );
    std::fs::write(sandbox.root().join("distribution"), distribution).unwrap();
    sandbox.write_state(r#"{"installedAgents":{"devin":{"agentName":"devin","installType":"script"}},"self":{}}"#);
}

#[test]
fn install_skips_login_and_records_the_verified_install() {
    let (sandbox, _stub) = release("3000.2.0", "3000.2.0", false);
    let run = sandbox.run(["install", "devin", "--json", "--non-interactive"]);
    assert_eq!(run.code, 0, "{run:?}");
    assert_eq!(run.json()["data"]["installed"], true);
    assert_eq!(run.json()["warnings"], json!([]));
    assert_eq!(
        sandbox.read_state().unwrap()["installedAgents"]["devin"]["installType"],
        "script"
    );
}

#[test]
fn update_uses_the_installer_without_running_the_terminal_only_updater() {
    let (sandbox, _stub) = release("3000.2.0", "3000.2.0", false);
    existing(
        &sandbox,
        "3000.1.0",
        if cfg!(windows) { "irm-iex" } else { "curl-bash" },
    );
    let run = sandbox.run(["update", "devin", "--json", "--non-interactive"]);
    assert_eq!(run.code, 0, "{run:?}");
    assert_eq!(run.json()["data"]["results"][0]["status"], "updated");
    assert_eq!(run.json()["data"]["results"][0]["latestVersion"], "3000.2.0");
}

#[test]
fn equal_or_older_releases_do_not_run_the_installer() {
    for version in ["3000.2.0", "3000.3.0"] {
        let (sandbox, _stub) = release("3000.2.0", "3000.2.0", true);
        existing(&sandbox, version, "curl-bash");
        let before = std::fs::read(
            sandbox
                .bin_dir()
                .join(if cfg!(windows) { "devin.cmd" } else { "devin" }),
        )
        .unwrap();
        let run = sandbox.run(["update", "devin", "--json"]);
        assert_eq!(run.code, 0, "{run:?}");
        assert_eq!(run.json()["data"]["results"][0]["status"], "up-to-date");
        assert_eq!(
            std::fs::read(
                sandbox
                    .bin_dir()
                    .join(if cfg!(windows) { "devin.cmd" } else { "devin" })
            )
            .unwrap(),
            before
        );
    }
}

#[test]
fn an_unrecognized_installer_is_rejected_before_it_runs() {
    let (sandbox, _stub) = release("3000.2.0", "3000.2.0", true);
    let run = sandbox.run(["install", "devin", "--json"]);
    assert_eq!(run.code, 1, "{run:?}");
    assert_eq!(run.json()["error"]["code"], "INSTALL_FAILED");
    assert!(
        !sandbox
            .bin_dir()
            .join(if cfg!(windows) { "devin.cmd" } else { "devin" })
            .exists()
    );
}

#[test]
fn successful_installer_exit_cannot_hide_a_wrong_version() {
    let (sandbox, _stub) = release("3000.2.0", "3000.1.0", false);
    let run = sandbox.run(["install", "devin", "--json"]);
    assert_eq!(run.code, 1, "{run:?}");
    assert_eq!(run.json()["error"]["code"], "INSTALL_FAILED");
    assert!(
        sandbox
            .read_state()
            .is_none_or(|state| state["installedAgents"]["devin"].is_null())
    );
}

#[test]
fn updating_a_non_public_distribution_does_not_replace_it() {
    let (sandbox, _stub) = release("3000.2.0", "3000.2.0", false);
    existing(&sandbox, "3000.1.0", "enterprise-portal");
    let run = sandbox.run(["update", "devin", "--json"]);
    assert_eq!(run.code, 1, "{run:?}");
    assert_eq!(run.json()["error"]["code"], "UPDATE_FAILED");
    assert_eq!(
        sandbox.run(["info", "devin", "--json"]).json()["data"]["inspection"]["installedVersion"],
        "3000.1.0"
    );
}
