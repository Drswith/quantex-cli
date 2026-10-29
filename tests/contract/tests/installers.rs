//! Official installers (`script` installs): which method goes first, where the
//! executable lands, adopting an existing install, updating through the agent's own
//! command, and uninstalling without an uninstaller. A fake `curl` stands in for the
//! vendor's download.
#![cfg(unix)]

use std::fs;
use std::path::{Path, PathBuf};

use quantex_contract_tests::{Sandbox, fake_npm};
use serde_json::{Value, json};

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

/// A fake `curl` whose "installer" writes an executable printing `banner` to `path`.
fn fake_installer(sandbox: &Sandbox, path: &Path, banner: &str) {
    let installer = format!(
        "cat <<'EOS'\nmkdir -p '{dir}'; printf '#!/bin/sh\\necho {banner}\\n' > '{path}'; chmod +x '{path}'\nEOS",
        dir = path.parent().unwrap().display(),
        path = path.display(),
    );
    sandbox.fake_tool("curl", &installer, "exit /b 1");
}

/// Where OpenCode's installer puts it: off the sandbox `PATH`.
fn opencode_path(sandbox: &Sandbox) -> PathBuf {
    sandbox.home().join(".opencode").join("bin").join("opencode")
}

/// An OpenCode at 1.0.0 whose `opencode upgrade` moves it to 1.1.0.
fn existing_opencode(sandbox: &Sandbox) -> PathBuf {
    let path = opencode_path(sandbox);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(
        &path,
        "#!/bin/sh\ndir=$(dirname \"$0\")\ncase \"$1\" in\n  upgrade) echo 1.1.0 > \"$dir/version\" ;;\n  *) cat \"$dir/version\" 2>/dev/null || echo 1.0.0 ;;\nesac\n",
    )
    .unwrap();
    let mut permissions = fs::metadata(&path).unwrap().permissions();
    std::os::unix::fs::PermissionsExt::set_mode(&mut permissions, 0o755);
    fs::set_permissions(&path, permissions).unwrap();
    path
}

/// The official installer comes first by default; `defaultPackageManager` moves a
/// package manager ahead of it.
#[test]
fn the_official_installer_is_tried_first() {
    let sandbox = sandbox();
    fake_installer(&sandbox, &sandbox.bin_dir().join("claude"), "2.1.0 (Claude Code)");
    let (code, envelope) = run_json(&sandbox, &["install", "claude"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"]["installState"], json!({ "installType": "script" }));
    assert!(!sandbox.npm_calls().iter().any(|call| call.starts_with("npm install")));

    let sandbox = self::sandbox();
    fake_installer(&sandbox, &sandbox.bin_dir().join("claude"), "2.1.0 (Claude Code)");
    sandbox.run(["config", "set", "defaultPackageManager", "npm"]);
    let (code, envelope) = run_json(&sandbox, &["install", "claude"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"]["installState"]["installType"], "npm");
    assert!(
        sandbox
            .npm_calls()
            .contains(&"npm install -g @anthropic-ai/claude-code".to_owned())
    );
}

/// The executable is found in the installer's own directory, and the result says it is
/// not on `PATH` yet.
#[test]
fn an_install_off_path_is_found_and_reported() {
    let sandbox = sandbox();
    fake_installer(&sandbox, &opencode_path(&sandbox), "1.0.0");
    let (code, envelope) = run_json(&sandbox, &["install", "opencode"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"]["installState"], json!({ "installType": "script" }));
    assert_eq!(envelope["warnings"][0]["code"], "NOT_ON_PATH", "{envelope}");

    let (code, envelope) = run_json(&sandbox, &["info", "opencode"]);
    assert_eq!(code, 0, "{envelope}");
    let inspection = &envelope["data"]["inspection"];
    assert_eq!(inspection["installed"], true, "{envelope}");
    assert_eq!(inspection["installedVersion"], "1.0.0");
    assert!(
        inspection["binaryPath"]
            .as_str()
            .unwrap()
            .ends_with(".opencode/bin/opencode"),
        "{envelope}"
    );
}

#[test]
fn an_existing_official_install_is_adopted() {
    let sandbox = sandbox();
    existing_opencode(&sandbox);
    let (code, envelope) = run_json(&sandbox, &["install", "opencode"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(
        envelope["warnings"][0]["code"], "TRACKED_EXISTING_INSTALL",
        "{envelope}"
    );
    assert_eq!(
        sandbox.read_state().unwrap()["installedAgents"]["opencode"]["installType"],
        "script"
    );
}

/// The agent's own update command runs even though the agent is not on `PATH`.
#[test]
fn updates_run_the_agents_own_command() {
    let sandbox = sandbox();
    existing_opencode(&sandbox);
    run_json(&sandbox, &["install", "opencode"]);
    let (code, envelope) = run_json(&sandbox, &["update", "opencode"]);
    assert_eq!(code, 0, "{envelope}");
    let result = &envelope["data"]["results"][0];
    assert_eq!(result["status"], "updated", "{envelope}");
    assert_eq!(result["installedVersion"], "1.0.0", "{envelope}");
    assert_eq!(result["latestVersion"], "1.1.0", "{envelope}");
    assert_eq!(result["strategy"], "self-update");
}

#[test]
fn uninstall_clears_the_record_and_says_the_files_stay() {
    let sandbox = sandbox();
    let path = existing_opencode(&sandbox);
    run_json(&sandbox, &["install", "opencode"]);
    let (code, envelope) = run_json(&sandbox, &["uninstall", "opencode"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"]["changed"], true);
    assert_eq!(envelope["warnings"][0]["code"], "FILES_KEPT", "{envelope}");
    assert!(
        envelope["warnings"][0]["message"]
            .as_str()
            .unwrap()
            .contains(&path.display().to_string()),
        "{envelope}"
    );
    assert!(path.exists());
    assert_eq!(sandbox.read_state().unwrap()["installedAgents"], json!({}));
}
