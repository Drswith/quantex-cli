//! Failed revalidation must never turn a cached version into an up-to-date result.
use quantex_contract_tests::{HttpStub, Sandbox, seed_cache};
use serde_json::json;
use std::fs;

#[test]
fn failed_upgrade_revalidation_never_falls_back_to_a_cached_manifest() {
    for (status, body) in [
        (403, "rate limited"),
        (429, "rate limited"),
        (503, "unavailable"),
        (200, "invalid JSON"),
    ] {
        for expired in [false, true] {
            let mut sandbox = Sandbox::new();
            let stub = HttpStub::start(vec![("/manifest.json", status, body)]);
            sandbox.env("QUANTEX_RELEASE_BASE_URL", stub.url());
            sandbox.write_config(&json!({"networkTimeoutMs":2000}));
            let exe = sandbox.copy_quantex();
            let original = fs::read(&exe).unwrap();
            let version = sandbox.run(["--version"]).stdout.trim().to_owned();
            let os = if cfg!(windows) {
                "win32"
            } else if cfg!(target_os = "macos") {
                "darwin"
            } else {
                "linux"
            };
            let arch = if cfg!(target_arch = "aarch64") { "arm64" } else { "x64" };
            let asset = if cfg!(windows) {
                "quantex-windows-x64.exe.zip".into()
            } else {
                format!("quantex-{os}-{arch}.tar.gz")
            };
            seed_cache(
                &sandbox,
                "self:manifest:stable",
                &json!({"version":version,"assets":[{"platform":os,"arch":arch,"name":asset}]}).to_string(),
            );
            let cache_path = sandbox.quantex_dir().join("cache/versions.json");
            if expired {
                let mut cache: serde_json::Value = serde_json::from_slice(&fs::read(&cache_path).unwrap()).unwrap();
                cache["entries"]["self:manifest:stable"]["expiresAt"] = json!(1);
                fs::write(&cache_path, cache.to_string()).unwrap();
            }
            let before = fs::read(&cache_path).unwrap();
            for args in [vec!["upgrade", "--json"], vec!["upgrade", "--check", "--json"]] {
                let run = sandbox.run_program(&exe, args);
                assert_eq!(run.code, 6, "{status} expired={expired}: {run:?}");
                let result = run.json();
                assert_eq!(result["error"]["code"], "NETWORK_ERROR");
                assert_eq!(result["data"]["status"], "check-unavailable");
                assert!(result["data"].get("latestVersion").is_none());
                assert_eq!(
                    fs::read(&cache_path).unwrap(),
                    before,
                    "failed fetch must not renew the TTL"
                );
                assert_eq!(fs::read(&exe).unwrap(), original);
            }
            assert_eq!(stub.hits().len(), if status == 503 { 6 } else { 2 });
        }
    }
}

#[test]
fn a_connection_failure_with_cached_metadata_is_not_up_to_date() {
    let sandbox = Sandbox::new();
    seed_cache(&sandbox, "self:manifest:stable", r#"{"version":"0.0.1","assets":[]}"#);
    let exe = sandbox.copy_quantex();
    let run = sandbox.run_program(&exe, ["upgrade", "--json"]);
    assert_eq!(run.code, 6, "{run:?}");
    assert_eq!(run.json()["data"]["status"], "check-unavailable");
}

#[cfg(unix)]
#[test]
fn failed_agent_refresh_does_not_report_cached_version_as_latest_or_run_an_updater() {
    let mut sandbox = Sandbox::new();
    quantex_contract_tests::fake_npm(&sandbox);
    let install = sandbox.run(["install", "codex", "--json"]);
    assert_eq!(install.code, 0, "{install:?}");
    let stub = HttpStub::start(vec![("/%40openai%2Fcodex/latest", 429, "rate limited")]);
    sandbox.env("QUANTEX_NPM_REGISTRY_URL", stub.url());
    sandbox.write_config(&json!({"networkTimeoutMs":2000}));
    seed_cache(
        &sandbox,
        &format!("npm:{}:@openai/codex:latest", stub.url()),
        r#"{"version":"0.50.0"}"#,
    );
    let calls = sandbox.npm_calls();
    let run = sandbox.run(["update", "codex", "--refresh", "--json"]);
    assert_eq!(run.code, 1, "{run:?}");
    assert_eq!(run.json()["data"]["results"][0]["status"], "failed");
    assert!(run.json()["data"]["results"][0].get("latestVersion").is_none());
    assert_eq!(
        sandbox.npm_calls().iter().filter(|s| s.contains("install -g")).count(),
        calls.iter().filter(|s| s.contains("install -g")).count()
    );
    let info = sandbox.run(["info", "codex", "--refresh", "--json"]).json();
    assert!(info["data"]["inspection"].get("latestVersion").is_none());
}

#[test]
fn only_an_etag_validated_304_renews_cached_metadata() {
    for with_etag in [false, true] {
        let mut sandbox = Sandbox::new();
        let stub = HttpStub::start(vec![("/manifest.json", 304, "")]);
        sandbox.env("QUANTEX_RELEASE_BASE_URL", stub.url());
        sandbox.write_config(&json!({"networkTimeoutMs":2000}));
        let exe = sandbox.copy_quantex();
        let version = sandbox.run(["--version"]).stdout.trim().to_owned();
        let os = if cfg!(windows) {
            "win32"
        } else if cfg!(target_os = "macos") {
            "darwin"
        } else {
            "linux"
        };
        let arch = if cfg!(target_arch = "aarch64") { "arm64" } else { "x64" };
        let asset = if cfg!(windows) {
            "quantex-windows-x64.exe.zip".into()
        } else {
            format!("quantex-{os}-{arch}.tar.gz")
        };
        seed_cache(
            &sandbox,
            "self:manifest:stable",
            &json!({"version":version,"assets":[{"platform":os,"arch":arch,"name":asset}]}).to_string(),
        );
        let path = sandbox.quantex_dir().join("cache/versions.json");
        let mut cache: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        cache["entries"]["self:manifest:stable"]["expiresAt"] = json!(1);
        if with_etag {
            cache["entries"]["self:manifest:stable"]["etag"] = json!("\"release\"");
        }
        fs::write(&path, cache.to_string()).unwrap();
        let before = fs::read(&path).unwrap();
        let run = sandbox.run_program(&exe, ["upgrade", "--check", "--json"]);
        if with_etag {
            assert_eq!(run.code, 0, "{run:?}");
            assert_eq!(run.json()["data"]["status"], "up-to-date");
            assert_eq!(run.json()["meta"]["source"], "network");
            let after: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
            assert!(after["entries"]["self:manifest:stable"]["expiresAt"].as_i64().unwrap() > 1);
        } else {
            assert_eq!(run.code, 6, "{run:?}");
            assert_eq!(fs::read(&path).unwrap(), before);
        }
        assert_eq!(stub.hits(), vec!["/manifest.json"]);
    }
}
