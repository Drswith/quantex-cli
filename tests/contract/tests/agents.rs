//! Read-only agent commands: `list`, `info`, `inspect`, `resolve`.

use quantex_contract_tests::{HttpStub, Sandbox, assert_envelope, contract_dir, fake_agent, real_path};
use serde_json::{Value, json};

const CODEX_NPM_STATE: &str = r#"{"installedAgents":{"codex":{"agentName":"codex","binaryName":"codex","installType":"npm","packageName":"@openai/codex"}},"self":{}}"#;

fn json_run(sandbox: &Sandbox, args: &[&str]) -> (i32, Value) {
    let mut full = args.to_vec();
    full.extend_from_slice(&["--json"]);
    let run = sandbox.run(&full);
    assert!(!run.stdout.is_empty(), "{full:?} printed nothing: {run:?}");
    (run.code, run.json())
}

fn catalog_names() -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(contract_dir().join("catalog"))
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "json"))
        .map(|path| path.file_stem().unwrap().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

fn find<'a>(agents: &'a Value, name: &str) -> &'a Value {
    agents
        .as_array()
        .unwrap()
        .iter()
        .find(|agent| agent["name"] == name)
        .unwrap_or_else(|| panic!("{name} missing from {agents}"))
}

#[test]
fn list_covers_the_catalog_and_reports_installs() {
    let sandbox = Sandbox::new();
    fake_agent(&sandbox, "codex", "codex-cli 0.48.0");
    fake_agent(&sandbox, "claude", "2.1.0 (Claude Code)");
    sandbox.write_state(CODEX_NPM_STATE);
    let (code, envelope) = json_run(&sandbox, &["list"]);
    assert_eq!(code, 0, "{envelope}");
    assert_envelope(&envelope, "list");
    assert_eq!(envelope["target"], json!({ "kind": "system", "name": "agents" }));
    let agents = &envelope["data"]["agents"];
    let names: Vec<String> = agents
        .as_array()
        .unwrap()
        .iter()
        .map(|agent| agent["name"].as_str().unwrap().to_owned())
        .collect();
    assert_eq!(names, catalog_names());

    assert_eq!(
        find(agents, "codex"),
        &json!({
            "binaryName": "codex",
            "displayName": "Codex CLI",
            "installed": true,
            "installedVersion": "0.48.0",
            "lifecycle": "managed",
            "name": "codex",
            "sourceLabel": "managed via npm (@openai/codex)",
            "updateLabel": "managed update",
        })
    );
    let claude = find(agents, "claude");
    assert_eq!(claude["installed"], true);
    assert_eq!(claude["installedVersion"], "2.1.0");
    assert_eq!(claude["lifecycle"], "unmanaged");
    assert_eq!(claude["sourceLabel"], "detected on disk");
    assert_eq!(claude["updateLabel"], "command update");
    let dsh = find(agents, "dsh");
    assert_eq!(dsh["installed"], false);
    assert!(dsh.get("installedVersion").is_none());
    assert_eq!(dsh["updateLabel"], "manual update");
}

#[test]
fn list_alias_matches_list() {
    let sandbox = Sandbox::new();
    let (code, envelope) = json_run(&sandbox, &["ls"]);
    assert_eq!(code, 0);
    assert_envelope(&envelope, "list");
}

#[test]
fn info_describes_an_installed_agent() {
    let sandbox = Sandbox::new();
    let codex = fake_agent(&sandbox, "codex", "codex-cli 0.48.0");
    sandbox.write_state(CODEX_NPM_STATE);
    let (code, envelope) = json_run(&sandbox, &["info", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    assert_envelope(&envelope, "info");
    assert_eq!(envelope["target"], json!({ "kind": "agent", "name": "codex" }));
    let agent = &envelope["data"]["agent"];
    assert_eq!(agent["name"], "codex");
    assert_eq!(agent["packageName"], "@openai/codex");
    assert_eq!(agent["selfUpdateCommands"], json!(["codex --upgrade"]));
    let methods = agent["installMethods"].as_array().unwrap();
    assert!(methods.contains(&json!({ "command": "npm i -g @openai/codex", "label": "managed/npm", "type": "npm" })));
    assert_eq!(
        envelope["data"]["inspection"],
        json!({
            "binaryPath": real_path(&codex),
            "installed": true,
            "installedVersion": "0.48.0",
            "lifecycle": "managed",
            "sourceLabel": "managed via npm (@openai/codex)",
            "updateLabel": "managed update",
        })
    );
}

#[test]
fn inspect_is_info_and_display_names_resolve() {
    let sandbox = Sandbox::new();
    fake_agent(&sandbox, "claude", "2.1.0 (Claude Code)");
    let (code, envelope) = json_run(&sandbox, &["inspect", "Claude Code"]);
    assert_eq!(code, 0, "{envelope}");
    assert_envelope(&envelope, "info");
    assert_eq!(envelope["target"], json!({ "kind": "agent", "name": "claude" }));
    assert_eq!(
        envelope["data"]["capabilities"],
        json!({ "canAutoInstall": true, "canAutoUninstall": false, "canRun": true, "canSelfUpdate": true })
    );
    let inspection = &envelope["data"]["inspection"];
    assert_eq!(inspection["updateLabel"], "command update");
    assert_eq!(inspection["sourceLabel"], "detected on disk");
}

#[test]
fn unknown_agents_are_not_found() {
    let sandbox = Sandbox::new();
    for command in ["info", "resolve"] {
        let (code, envelope) = json_run(&sandbox, &[command, "not-an-agent"]);
        assert_eq!(code, 3, "{command}: {envelope}");
        assert_envelope(&envelope, command);
        assert_eq!(
            envelope["error"],
            json!({
                "code": "AGENT_NOT_FOUND",
                "details": { "input": "not-an-agent" },
                "message": "Unknown agent: not-an-agent",
            })
        );
        assert_eq!(envelope["target"], json!({ "kind": "agent", "name": "not-an-agent" }));
    }
}

#[test]
fn resolve_returns_the_launch_command() {
    let sandbox = Sandbox::new();
    let codex = fake_agent(&sandbox, "codex", "codex-cli 0.48.0");
    sandbox.write_state(CODEX_NPM_STATE);
    let (code, envelope) = json_run(&sandbox, &["resolve", "codex"]);
    assert_eq!(code, 0, "{envelope}");
    let path = real_path(&codex);
    assert_eq!(
        envelope["data"]["resolution"],
        json!({
            "binaryPath": path,
            "installSource": "npm",
            "installed": true,
            "installedVersion": "0.48.0",
            "lifecycle": "managed",
            "sourceLabel": "managed via npm (@openai/codex)",
            "suggestedLaunchCommand": [path],
        })
    );
}

#[test]
fn resolve_explains_how_to_install_a_missing_agent() {
    let (code, envelope) = json_run(&Sandbox::new(), &["resolve", "kilo"]);
    assert_eq!(code, 4, "{envelope}");
    assert_eq!(envelope["ok"], false);
    assert_eq!(envelope["error"]["code"], "AGENT_NOT_INSTALLED");
    assert_eq!(envelope["error"]["message"], "Kilo CLI is not installed.");
    let guidance = &envelope["data"]["resolution"]["installGuidance"];
    assert_eq!(guidance["suggestedEnsureCommand"], "quantex ensure kilo");
    assert_eq!(guidance["docsRef"], "skills/quantex-cli/references/command-recipes.md");
    assert_eq!(envelope["error"]["details"], *guidance);
    assert_eq!(envelope["data"]["resolution"]["installSource"], "not-installed");
    assert_eq!(envelope["data"]["resolution"]["suggestedLaunchCommand"], json!([]));
}

#[test]
fn superseded_recorded_packages_produce_a_warning() {
    let sandbox = Sandbox::new();
    sandbox.write_state(
        r#"{"installedAgents":{"pi":{"agentName":"pi","installType":"npm","packageName":"@mariozechner/pi-coding-agent"}},"self":{}}"#,
    );
    for command in ["list", "info"] {
        let mut args = vec![command];
        if command == "info" {
            args.push("pi");
        }
        let (code, envelope) = json_run(&sandbox, &args);
        assert_eq!(code, 0, "{envelope}");
        let warning = envelope["warnings"]
            .as_array()
            .unwrap()
            .iter()
            .find(|warning| warning["code"] == "AGENT_PACKAGE_SUPERSEDED")
            .unwrap_or_else(|| panic!("{command}: no superseded warning in {envelope}"));
        assert_eq!(
            warning["details"],
            json!({
                "agentName": "pi",
                "currentPackage": "@earendil-works/pi-coding-agent",
                "recordedPackage": "@mariozechner/pi-coding-agent",
                "suggestedAction": "reinstall-agent",
                "suggestedCommands": ["quantex uninstall pi", "quantex install pi"],
            })
        );
    }
}

#[test]
fn unreadable_state_is_a_state_read_error() {
    let sandbox = Sandbox::new();
    for (contents, reason) in [
        (
            std::fs::read_to_string(contract_dir().join("fixtures/state/corrupt.txt")).unwrap(),
            "invalid JSON",
        ),
        (r#"{"schemaVersion":3}"#.to_owned(), "unsupported schemaVersion \"3\"."),
    ] {
        sandbox.write_state(&contents);
        let (code, envelope) = json_run(&sandbox, &["list"]);
        assert_eq!(code, 12, "{envelope}");
        assert_eq!(envelope["error"]["code"], "STATE_READ_ERROR");
        let message = envelope["error"]["message"].as_str().unwrap();
        assert!(message.starts_with("Failed to read Quantex state file: "), "{message}");
        assert!(message.contains(reason), "{message}");
        let path = envelope["error"]["details"]["stateFilePath"].as_str().unwrap();
        assert!(path.ends_with("state.json"), "{path}");
        assert_eq!(envelope["target"], json!({ "kind": "system", "name": "agents" }));
    }
}

#[test]
fn latest_versions_come_from_the_registry_and_the_cache() {
    let stub = HttpStub::start(vec![("/%40sourcegraph%2Famp/latest", 200, r#"{"version":"9.9.9"}"#)]);
    let mut sandbox = Sandbox::new();
    sandbox.env("QUANTEX_NPM_REGISTRY_URL", stub.url());
    sandbox.write_config(&json!({ "networkTimeoutMs": 2000 }));
    fake_agent(&sandbox, "amp", "1.0.0");

    let (_, envelope) = json_run(&sandbox, &["info", "amp"]);
    assert_eq!(envelope["data"]["inspection"]["latestVersion"], "9.9.9", "{envelope}");
    assert_eq!(envelope["meta"]["source"], "network");
    assert!(envelope["meta"]["fetchedAt"].is_string());
    assert!(envelope["meta"]["staleAfter"].is_string());
    let cache: Value =
        serde_json::from_str(&std::fs::read_to_string(sandbox.quantex_dir().join("cache/versions.json")).unwrap())
            .unwrap();
    let key = format!("npm:{}:@sourcegraph/amp:latest", stub.url());
    assert_eq!(cache["entries"][&key]["body"], r#"{"version":"9.9.9"}"#);

    let hits = stub.hits().len();
    let (_, envelope) = json_run(&sandbox, &["info", "amp"]);
    assert_eq!(envelope["meta"]["source"], "cache");
    assert_eq!(stub.hits().len(), hits, "a fresh cache entry is not refetched");

    let (_, envelope) = json_run(&sandbox, &["info", "amp", "--refresh"]);
    assert_eq!(envelope["meta"]["source"], "network");
    assert!(stub.hits().len() > hits);
}
