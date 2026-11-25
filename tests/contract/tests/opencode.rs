//! OpenCode 2 installation and explicit migration from every recorded v1 source.
use quantex_contract_tests::Sandbox;
use serde_json::json;

fn executable(sandbox: &Sandbox, version: &str) {
    sandbox.fake_tool(
        "opencode",
        &format!("if [ \"$1\" = upgrade ]; then echo updater-ran >&2; exit 0; fi\necho {version}"),
        &format!("if \"%~1\"==\"upgrade\" (\r\n echo updater-ran 1>&2\r\n exit /b 0\r\n)\r\necho {version}"),
    );
}

#[test]
fn catalog_routes_install_opencode_two() {
    let sandbox = Sandbox::new();
    let info = sandbox.run(["info", "opencode", "--json"]).json();
    assert_eq!(info["data"]["agent"]["packageName"], "@opencode/cli");
    let methods = info["data"]["agent"]["installMethods"].as_array().unwrap();
    assert_eq!(methods.len(), if cfg!(windows) { 2 } else { 3 });
    for method in methods {
        let command = method["command"].as_str().unwrap();
        if method["type"] == "script" {
            assert_eq!(command, "curl -fsSL https://opencode.ai/v2/install | bash");
        } else {
            assert!(command.contains("@opencode/cli"), "{method}");
        }
        assert!(!command.contains("opencode-ai"));
    }
}

#[test]
fn old_npm_and_bun_packages_require_explicit_migration_without_mutating_state() {
    for provider in ["npm", "bun"] {
        let sandbox = Sandbox::new();
        executable(&sandbox, "1.19.6");
        sandbox.write_state(
            &json!({"installedAgents":{"opencode":{
            "agentName":"opencode", "installType":provider, "packageName":"opencode-ai"
        }}, "self":{}})
            .to_string(),
        );
        sandbox.fake_tool(
            "npm",
            "echo '{\"dependencies\":{\"opencode-ai\":{\"version\":\"1.19.6\"}}}'",
            "echo {\"dependencies\":{\"opencode-ai\":{\"version\":\"1.19.6\"}}}",
        );
        sandbox.fake_tool("bun", "echo opencode-ai@1.19.6", "echo opencode-ai@1.19.6");
        let before = sandbox.read_state();
        for args in [
            vec!["update", "opencode"],
            vec!["update", "--all"],
            vec!["update", "opencode", "--dry-run"],
        ] {
            let mut args = args;
            args.push("--json");
            let run = sandbox.run(args);
            assert_eq!(run.code, 0, "{run:?}");
            let envelope = run.json();
            assert_eq!(envelope["data"]["results"][0]["status"], "manual-required");
            let warning = &envelope["warnings"][0];
            assert_eq!(warning["code"], "AGENT_PACKAGE_SUPERSEDED");
            assert_eq!(warning["details"]["currentPackage"], "@opencode/cli");
            assert_eq!(
                warning["details"]["suggestedCommands"],
                json!(["quantex uninstall opencode", "quantex install opencode"])
            );
            assert!(
                warning["message"]
                    .as_str()
                    .unwrap()
                    .contains("https://opencode.ai/docs/migrate-v1")
            );
            assert!(!run.stderr.contains("updater-ran"));
            assert_eq!(sandbox.read_state(), before);
        }
        let install = sandbox.run(["install", "opencode", "--json"]);
        assert_eq!(install.code, 0, "{install:?}");
        assert_eq!(install.json()["warnings"][1]["code"], "AGENT_PACKAGE_SUPERSEDED");
    }
}

#[test]
fn script_v1_requires_migration_and_v2_resumes_self_updates() {
    let sandbox = Sandbox::new();
    sandbox.write_state(r#"{"installedAgents":{"opencode":{"agentName":"opencode","installType":"script","command":"curl -fsSL https://opencode.ai/install | bash"}},"self":{}}"#);
    executable(&sandbox, "1.19.6");
    let before = sandbox.read_state();
    for args in [
        vec!["update", "opencode"],
        vec!["update", "--all"],
        vec!["update", "opencode", "--dry-run"],
    ] {
        let mut args = args;
        args.push("--json");
        let run = sandbox.run(args);
        assert_eq!(run.code, 0, "{run:?}");
        let envelope = run.json();
        assert_eq!(envelope["data"]["results"][0]["status"], "manual-required");
        assert_eq!(envelope["warnings"][0]["code"], "AGENT_MAJOR_UPGRADE_REQUIRED");
        assert!(
            envelope["data"]["results"][0]["message"]
                .as_str()
                .unwrap()
                .contains("https://opencode.ai/v2/install")
        );
        assert!(!run.stderr.contains("updater-ran"));
        assert_eq!(sandbox.read_state(), before);
    }
    let info = sandbox.run(["info", "opencode", "--json"]).json();
    assert_eq!(info["warnings"][0]["code"], "AGENT_MAJOR_UPGRADE_REQUIRED");
    let doctor = sandbox.run(["doctor", "--json"]).json();
    assert!(
        doctor["data"]["issues"]
            .as_array()
            .unwrap()
            .iter()
            .any(|issue| issue["code"] == "AGENT_MAJOR_UPGRADE_REQUIRED")
    );

    // The official v2 installer replaces the executable; the existing record stays valid.
    executable(&sandbox, "2.4.1");
    let run = sandbox.run(["update", "opencode", "--json"]);
    assert_eq!(run.code, 0, "{run:?}");
    assert_eq!(run.json()["data"]["results"][0]["status"], "up-to-date");
    assert_eq!(run.json()["warnings"], json!([]));
    assert!(run.stderr.contains("updater-ran"));
    assert_eq!(sandbox.read_state(), before);
}

#[cfg(unix)]
#[test]
fn explicit_package_migration_removes_old_package_and_records_v2() {
    use quantex_contract_tests::{fake_npm, seed_latest_version};
    use std::fs;
    let sandbox = Sandbox::new();
    fake_npm(&sandbox);
    executable(&sandbox, "1.19.6");
    sandbox.write_state(r#"{"installedAgents":{"opencode":{"agentName":"opencode","installType":"npm","packageName":"opencode-ai"}},"self":{}}"#);
    fs::write(sandbox.root().join("npm-installed.txt"), "opencode-ai\n").unwrap();
    fs::write(sandbox.root().join("npm-version-opencode"), "1.19.6").unwrap();
    let config = sandbox.home().join(".config/opencode/opencode.json");
    fs::create_dir_all(config.parent().unwrap()).unwrap();
    fs::write(&config, "keep existing user data").unwrap();
    let uninstall = sandbox.run(["uninstall", "opencode", "--json"]);
    assert_eq!(uninstall.code, 0, "{uninstall:?}");
    assert!(sandbox.npm_calls().contains(&"npm uninstall -g opencode-ai".into()));
    sandbox.run(["config", "set", "defaultPackageManager", "npm"]);
    fs::write(sandbox.root().join("npm-next-version"), "2.4.1").unwrap();
    let install = sandbox.run(["install", "opencode", "--json"]);
    assert_eq!(install.code, 0, "{install:?}");
    assert_eq!(
        sandbox.read_state().unwrap()["installedAgents"]["opencode"]["packageName"],
        "@opencode/cli"
    );
    assert!(
        sandbox
            .npm_calls()
            .contains(&"npm install -g @opencode/cli --allow-scripts=@opencode/cli".into())
    );
    assert_eq!(fs::read_to_string(config).unwrap(), "keep existing user data");
    seed_latest_version(&sandbox, "@opencode/cli", "2.4.1");
    let update = sandbox.run(["update", "opencode", "--json"]);
    assert_eq!(update.code, 0, "{update:?}");
    assert_eq!(update.json()["data"]["results"][0]["status"], "up-to-date");
}
