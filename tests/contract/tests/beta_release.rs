//! Beta discovery must not depend on API ordering, dates, or page boundaries.
use quantex_contract_tests::{HttpStub, Sandbox};
use serde_json::{Value, json};

fn release(base: &str, version: &str) -> Value {
    json!({"tag_name":format!("v{version}"),"draft":false,"prerelease":true,
        "assets":[{"name":"manifest.json","browser_download_url":format!("{base}/{version}/manifest.json")}]})
}

fn manifest(version: &str) -> Value {
    let os = if cfg!(windows) {
        "win32"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };
    let arch = if cfg!(target_arch = "aarch64") { "arm64" } else { "x64" };
    let name = if cfg!(windows) {
        "quantex-windows-x64.exe.zip".into()
    } else {
        format!("quantex-{os}-{arch}.tar.gz")
    };
    json!({"version":version,"assets":[{"platform":os,"arch":arch,"name":name}]})
}

fn check(stub: &HttpStub) -> quantex_contract_tests::Run {
    let mut sandbox = Sandbox::new();
    sandbox.env("QUANTEX_GITHUB_RELEASES_URL", &format!("{}/releases", stub.url()));
    sandbox.write_config(&json!({"networkTimeoutMs":2000}));
    let exe = sandbox.copy_quantex();
    sandbox.run_program(&exe, ["upgrade", "--check", "--channel", "beta", "--refresh", "--json"])
}

fn page(stub: &HttpStub, number: u8, releases: &[Value]) {
    stub.route(
        &format!("/releases?per_page=100&page={number}"),
        200,
        serde_json::to_vec(releases).unwrap(),
    );
}

fn unavailable(run: quantex_contract_tests::Run) {
    assert_eq!(run.code, 6, "{run:?}");
    assert_eq!(run.json()["data"]["status"], "check-unavailable");
    assert_eq!(run.json()["error"]["code"], "NETWORK_ERROR");
    assert!(run.json()["data"].get("latestVersion").is_none());
}

#[test]
fn beta_versions_are_ordered_numerically_not_by_api_position_or_date() {
    for versions in [
        ["9.0.0-beta.9", "9.0.0-beta.11", "9.0.0-beta.10"],
        ["9.0.0-beta.10", "9.0.0-beta.9", "9.0.0-beta.11"],
        ["9.0.0-beta.11", "9.0.0-beta.10", "9.0.0-beta.9"],
    ] {
        let stub = HttpStub::start(vec![]);
        let mut releases: Vec<_> = versions.iter().map(|v| release(stub.url(), v)).collect();
        for r in &mut releases {
            r["published_at"] = json!("2099-12-31T00:00:00Z");
        }
        releases.iter_mut().find(|r| r["tag_name"] == "v9.0.0-beta.11").unwrap()["published_at"] =
            json!("2020-01-01T00:00:00Z");
        let mut draft = release(stub.url(), "99.0.0-beta.1");
        draft["draft"] = json!(true);
        let mut stable = release(stub.url(), "99.0.0");
        stable["prerelease"] = json!(false);
        releases.splice(0..0, [draft, stable, release(stub.url(), "not-a-version")]);
        page(&stub, 1, &releases);
        stub.route(
            "/9.0.0-beta.11/manifest.json",
            200,
            manifest("9.0.0-beta.11").to_string().into_bytes(),
        );
        let run = check(&stub);
        assert_eq!(run.code, 1, "{run:?}");
        assert_eq!(run.json()["data"]["latestVersion"], "9.0.0-beta.11");
        assert_eq!(run.json()["data"]["status"], "update-available");
        assert_eq!(run.json()["meta"]["source"], "network");
        assert_eq!(
            stub.hits(),
            vec!["/releases?per_page=100&page=1", "/9.0.0-beta.11/manifest.json"]
        );
    }
}

#[test]
fn the_highest_beta_can_be_on_a_later_page() {
    let stub = HttpStub::start(vec![]);
    page(&stub, 1, &vec![release(stub.url(), "9.0.0-beta.9"); 100]);
    page(&stub, 2, &[release(stub.url(), "9.0.0-beta.10")]);
    stub.route(
        "/9.0.0-beta.10/manifest.json",
        200,
        manifest("9.0.0-beta.10").to_string().into_bytes(),
    );
    let run = check(&stub);
    assert_eq!(run.code, 1, "{run:?}");
    assert_eq!(run.json()["data"]["latestVersion"], "9.0.0-beta.10");
    assert_eq!(
        stub.hits(),
        vec![
            "/releases?per_page=100&page=1",
            "/releases?per_page=100&page=2",
            "/9.0.0-beta.10/manifest.json"
        ]
    );
}

#[test]
fn incomplete_pages_never_make_the_first_pages_beta_latest() {
    for exhausted in [false, true] {
        let stub = HttpStub::start(vec![]);
        for n in 1..=if exhausted { 10 } else { 1 } {
            page(&stub, n, &vec![release(stub.url(), "9.0.0-beta.9"); 100]);
        }
        if !exhausted {
            stub.route("/releases?per_page=100&page=2", 429, b"rate limited".to_vec());
        }
        unavailable(check(&stub));
        assert_eq!(stub.hits().len(), if exhausted { 10 } else { 2 });
        assert!(stub.hits().iter().all(|s| s.starts_with("/releases?")));
    }
}

#[test]
fn invalid_latest_manifests_do_not_fall_back_to_an_older_beta() {
    for problem in ["missing-asset", "missing-manifest", "wrong-version"] {
        let stub = HttpStub::start(vec![]);
        let older = release(stub.url(), "9.0.0-beta.9");
        let mut latest = release(stub.url(), "9.0.0-beta.10");
        if problem == "missing-asset" {
            latest["assets"] = json!([]);
        }
        if problem == "wrong-version" {
            stub.route(
                "/9.0.0-beta.10/manifest.json",
                200,
                manifest("9.0.0-beta.9").to_string().into_bytes(),
            );
        }
        page(&stub, 1, &[older, latest]);
        unavailable(check(&stub));
        assert!(!stub.hits().contains(&"/9.0.0-beta.9/manifest.json".into()));
    }
}

#[test]
fn no_valid_published_prerelease_is_unavailable() {
    let stub = HttpStub::start(vec![]);
    let mut stable = release(stub.url(), "99.0.0");
    stable["prerelease"] = json!(false);
    let mut draft = release(stub.url(), "99.0.0-beta.1");
    draft["draft"] = json!(true);
    page(&stub, 1, &[stable, draft, release(stub.url(), "nightly")]);
    unavailable(check(&stub));
    assert_eq!(stub.hits().len(), 1);
}
