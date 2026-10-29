//! `upgrade` of a standalone binary: each test upgrades a private copy of the binary
//! under test from a release served locally. The manifest comes from the response
//! cache, which a failed refresh falls back to, so no test touches the network.
#![cfg(unix)]

use std::fs;
use std::path::PathBuf;

use quantex_contract_tests::{HttpStub, Run, Sandbox, release_tar_gz, seed_cache, sha256_hex};
use serde_json::{Value, json};

fn platform() -> (&'static str, &'static str) {
    let os = if cfg!(target_os = "macos") { "darwin" } else { "linux" };
    let arch = if cfg!(target_arch = "aarch64") { "arm64" } else { "x64" };
    (os, arch)
}

fn binary_name() -> String {
    let (os, arch) = platform();
    format!("quantex-{os}-{arch}")
}

/// A release whose binary prints `reports`, published as `version`.
struct Release {
    version: &'static str,
    reports: &'static str,
    checksum: Option<String>,
    served: bool,
}

impl Default for Release {
    fn default() -> Self {
        Self {
            version: "9.9.9",
            reports: "9.9.9",
            checksum: None,
            served: true,
        }
    }
}

struct Install {
    sandbox: Sandbox,
    exe: PathBuf,
    original: Vec<u8>,
    _stub: HttpStub,
}

impl Install {
    fn new(release: Release) -> Self {
        let sandbox = Sandbox::new();
        let exe = sandbox.copy_quantex();
        let original = fs::read(&exe).unwrap();
        let asset = format!("{}.tar.gz", binary_name());
        let archive = release_tar_gz(
            &binary_name(),
            format!("#!/bin/sh\necho {}\n", release.reports).as_bytes(),
        );
        let path = format!("/download/{asset}");
        let routes = if release.served {
            vec![(path.clone(), 200, archive.clone())]
        } else {
            Vec::new()
        };
        let stub = HttpStub::serve(routes);
        let (os, arch) = platform();
        let manifest = json!({
            "assets": [{
                "arch": arch,
                "checksum": release.checksum.unwrap_or_else(|| sha256_hex(&archive)),
                "downloadUrl": format!("{}{path}", stub.url()),
                "name": asset,
                "platform": os,
                "size": archive.len(),
            }],
            "channel": "stable",
            "version": release.version,
        });
        seed_cache(&sandbox, "self:manifest:stable", &manifest.to_string());
        Self {
            sandbox,
            exe,
            original,
            _stub: stub,
        }
    }

    fn run(&self, args: &[&str]) -> Run {
        self.sandbox.run_program(&self.exe, args)
    }

    fn upgrade(&self, extra: &[&str]) -> (i32, Value) {
        let mut args = vec!["upgrade"];
        args.extend_from_slice(extra);
        args.extend_from_slice(&["--json"]);
        let run = self.run(&args);
        (run.code, run.json())
    }

    fn replaced(&self) -> bool {
        fs::read(&self.exe).unwrap() != self.original
    }

    fn leftovers(&self) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(self.exe.parent().unwrap())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|name| name != "quantex")
            .collect();
        names.sort();
        names
    }
}

#[test]
fn upgrade_replaces_the_binary() {
    let install = Install::new(Release::default());
    let (code, envelope) = install.upgrade(&[]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["action"], "upgrade");
    assert_eq!(envelope["target"], json!({ "kind": "self", "name": "quantex" }));
    let data = &envelope["data"];
    assert_eq!(data["status"], "updated");
    assert_eq!(data["installSource"], "binary");
    assert_eq!(data["canAutoUpdate"], true);
    assert_eq!(data["channel"], "stable");
    assert_eq!(data["latestVersion"], "9.9.9");
    assert!(data["currentVersion"].is_string());
    assert!(install.replaced(), "the new binary is in place");
    assert!(
        install.leftovers().is_empty(),
        "no backup or temp dir is left: {:?}",
        install.leftovers()
    );
    assert_eq!(install.sandbox.read_state().unwrap()["self"]["installSource"], "binary");
}

#[test]
fn check_reports_an_update_with_exit_code_1() {
    let install = Install::new(Release::default());
    let (code, envelope) = install.upgrade(&["--check"]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(envelope["ok"], true);
    assert_eq!(envelope["exitCode"], 1);
    assert_eq!(envelope["data"]["status"], "update-available");
    assert!(!install.replaced());
}

#[test]
fn dry_run_does_not_replace_the_binary() {
    let install = Install::new(Release::default());
    let (code, envelope) = install.upgrade(&["--dry-run"]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"]["status"], "update-available");
    assert_eq!(
        envelope["warnings"],
        json!([{ "code": "DRY_RUN", "message": "Dry run: would upgrade Quantex CLI." }])
    );
    assert!(!install.replaced());
}

#[test]
fn an_older_latest_is_up_to_date_and_never_a_downgrade() {
    let install = Install::new(Release {
        version: "0.0.1",
        reports: "0.0.1",
        ..Release::default()
    });
    let (code, envelope) = install.upgrade(&[]);
    assert_eq!(code, 0, "{envelope}");
    assert_eq!(envelope["data"]["status"], "up-to-date");
    assert_eq!(envelope["warnings"][0]["code"], "STALE_LATEST_VERSION");
    assert_eq!(envelope["warnings"][0]["details"]["latestVersion"], "0.0.1");
    assert!(!install.replaced());
}

#[test]
fn a_checksum_mismatch_keeps_the_binary() {
    let install = Install::new(Release {
        checksum: Some("0".repeat(64)),
        ..Release::default()
    });
    let (code, envelope) = install.upgrade(&[]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(envelope["error"]["code"], "UPGRADE_FAILED");
    assert_eq!(envelope["error"]["details"], json!({ "kind": "checksum" }));
    assert!(
        envelope["error"]["message"]
            .as_str()
            .unwrap()
            .starts_with("Checksum mismatch for ")
    );
    let data = &envelope["data"];
    assert_eq!(data["status"], "manual-required");
    let hint = data["recoveryHint"].as_str().unwrap();
    assert!(
        hint.starts_with("download and replace the binary from http://127.0.0.1:"),
        "{hint}"
    );
    assert_eq!(
        envelope["warnings"],
        json!([{ "code": "MANUAL_RECOVERY", "message": format!("Manual recovery: {hint}") }])
    );
    assert!(!install.replaced());
    assert!(install.leftovers().is_empty());
}

#[test]
fn a_binary_that_fails_verification_is_rolled_back() {
    let install = Install::new(Release {
        reports: "1.0.0",
        ..Release::default()
    });
    let (code, envelope) = install.upgrade(&[]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(envelope["error"]["details"], json!({ "kind": "verify" }));
    assert_eq!(
        envelope["error"]["message"],
        "The upgraded Quantex binary reported an unexpected version during verification."
    );
    assert!(!install.replaced(), "the original binary is restored");
    assert!(install.leftovers().is_empty(), "{:?}", install.leftovers());
}

#[test]
fn a_failed_download_is_a_network_failure() {
    let install = Install::new(Release {
        served: false,
        ..Release::default()
    });
    let (code, envelope) = install.upgrade(&[]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(envelope["error"]["details"], json!({ "kind": "network" }));
    assert!(envelope["error"]["message"].as_str().unwrap().ends_with(": HTTP 404."));
    assert!(
        envelope["data"]["recoveryHint"]
            .as_str()
            .unwrap()
            .starts_with("check network access and retry")
    );
}

#[test]
fn no_manifest_means_the_check_is_unavailable() {
    let sandbox = Sandbox::new();
    let exe = sandbox.copy_quantex();
    let run = sandbox.run_program(&exe, ["upgrade", "--json"]);
    assert_eq!(run.code, 6, "{run:?}");
    let envelope = run.json();
    assert_eq!(
        envelope["error"],
        json!({ "code": "NETWORK_ERROR", "message": "Unable to determine the latest Quantex CLI version." })
    );
    assert_eq!(envelope["data"]["status"], "check-unavailable");
    assert!(envelope["data"].get("latestVersion").is_none());
}

#[test]
fn a_running_upgrade_holds_the_lock() {
    let install = Install::new(Release::default());
    let lock = install.sandbox.quantex_dir().join("locks").join("self-upgrade.lock");
    fs::create_dir_all(&lock).unwrap();
    fs::write(
        lock.join("owner.json"),
        json!({ "createdAt": "2026-01-01T00:00:00.000Z", "pid": std::process::id() }).to_string(),
    )
    .unwrap();
    let (code, envelope) = install.upgrade(&[]);
    assert_eq!(code, 1, "{envelope}");
    assert_eq!(
        envelope["error"],
        json!({ "code": "UPGRADE_FAILED", "details": { "kind": "locked" }, "message": "Another qtx upgrade is already running." })
    );
    assert_eq!(
        envelope["data"]["recoveryHint"],
        "another qtx upgrade is already running; wait for it to finish and retry"
    );
    assert!(!install.replaced());
}

#[test]
fn a_found_update_is_mentioned_after_later_commands() {
    let install = Install::new(Release::default());
    install.upgrade(&["--check"]);
    let run = install.run(&["list"]);
    assert_eq!(run.code, 0, "{run:?}");
    let output = format!("{}{}", run.stdout, run.stderr);
    assert!(output.contains("Quantex CLI 9.9.9 is available"), "{output}");
    let quiet = install.run(&["list", "--json"]);
    assert!(!quiet.stdout.contains("is available") && !quiet.stderr.contains("is available"));
}

#[test]
fn an_npm_install_upgrades_through_npm() {
    let sandbox = Sandbox::new();
    let (os, arch) = platform();
    let package_bin = sandbox
        .root()
        .join("lib/node_modules")
        .join(format!("quantex-cli-{os}-{arch}"))
        .join("bin");
    fs::create_dir_all(&package_bin).unwrap();
    let exe = package_bin.join("quantex");
    fs::copy(quantex_contract_tests::quantex_bin(), &exe).unwrap();
    sandbox.fake_tool(
        "npm",
        &format!(
            // Like npm, replace the file rather than rewrite it: Linux refuses writes to a
            // running executable.
            "echo \"npm $*\" >> \"{log}\"\nif [ \"$1\" = install ]; then printf '#!/bin/sh\\necho 9.9.9\\n' > \"{exe}.new\" && chmod +x \"{exe}.new\" && mv \"{exe}.new\" \"{exe}\"; fi\nexit 0",
            log = sandbox.root().join("npm-calls.log").display(),
            exe = exe.display()
        ),
        "exit /b 1",
    );
    quantex_contract_tests::seed_latest_version(&sandbox, "quantex-cli", "9.9.9");
    let run = sandbox.run_program(&exe, ["upgrade", "--json"]);
    assert_eq!(run.code, 0, "{run:?}");
    let envelope = run.json();
    assert_eq!(envelope["data"]["installSource"], "npm");
    assert_eq!(envelope["data"]["status"], "updated");
    let calls = fs::read_to_string(sandbox.root().join("npm-calls.log")).unwrap();
    assert!(
        calls.contains("npm install -g quantex-cli@latest --registry "),
        "{calls}"
    );
}
