//! `upgrade` of a standalone Windows binary: the executable cannot be replaced while it
//! runs, so a helper swaps it after quantex exits. This checks the helper outlives it.
#![cfg(windows)]

use std::fs;
use std::time::{Duration, Instant};

use quantex_contract_tests::{HttpStub, Sandbox, is_reference, release_zip, seed_cache, sha256_hex};
use serde_json::json;

#[test]
fn a_windows_binary_is_replaced_once_upgrade_exits() {
    // v1.13.x reported "updated" but its helper died with it, so nothing was replaced.
    if is_reference() {
        return;
    }
    let sandbox = Sandbox::new();
    let exe = sandbox.copy_quantex();
    let newer = fs::read(env!("CARGO_BIN_EXE_print-version")).unwrap();
    let archive = release_zip("quantex-windows-x64.exe", &newer);
    let path = "/download/quantex-windows-x64.exe.zip".to_owned();
    let stub = HttpStub::serve(vec![(path.clone(), 200, archive.clone())]);
    let manifest = json!({
        "assets": [{
            "arch": "x64",
            "checksum": sha256_hex(&archive),
            "downloadUrl": format!("{}{path}", stub.url()),
            "name": "quantex-windows-x64.exe.zip",
            "platform": "win32",
            "size": archive.len(),
        }],
        "channel": "stable",
        "version": "9.9.9",
    });
    seed_cache(&sandbox, "self:manifest:stable", &manifest.to_string());

    let run = sandbox.run_program(&exe, ["upgrade", "--output", "json"]);
    assert_eq!(run.code, 0, "{run:?}");
    assert_eq!(run.json()["data"]["status"], "updated");

    // Give the helper time to see this process exit before running the binary again.
    std::thread::sleep(Duration::from_secs(3));
    let deadline = Instant::now() + Duration::from_secs(60);
    let mut reported = String::new();
    while Instant::now() < deadline {
        reported = sandbox.run_program(&exe, ["--version"]).stdout.trim().to_owned();
        if reported == "9.9.9" {
            break;
        }
        std::thread::sleep(Duration::from_secs(2));
    }
    assert_eq!(reported, "9.9.9", "the executable was replaced");

    let dir = exe.parent().unwrap();
    let mut leftovers = Vec::new();
    while Instant::now() < deadline {
        leftovers = fs::read_dir(dir)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|name| name != "quantex.exe")
            .collect();
        if leftovers.is_empty() {
            break;
        }
        std::thread::sleep(Duration::from_secs(1));
    }
    assert!(
        leftovers.is_empty(),
        "no backup or staging directory is left: {leftovers:?}"
    );
}
