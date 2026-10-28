//! Temporary: which ways of starting Windows PowerShell run a script at all.
#![cfg(windows)]

use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};

fn encode(script: &str) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let n = (u32::from(chunk[0]) << 16)
            | (u32::from(chunk.get(1).copied().unwrap_or(0)) << 8)
            | u32::from(chunk.get(2).copied().unwrap_or(0));
        out.push(TABLE[(n >> 18) as usize & 63] as char);
        out.push(TABLE[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 {
            TABLE[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            TABLE[n as usize & 63] as char
        } else {
            '='
        });
    }
    out
}

#[test]
fn probe_powershell_start() {
    let root = std::env::var_os("SystemRoot").unwrap();
    let powershell = std::path::PathBuf::from(&root).join(r"System32\WindowsPowerShell\v1.0\powershell.exe");
    let dir = tempfile::tempdir().unwrap();
    let script = encode("Write-Output 'started'\nGet-Process -Id $PID | Out-Null\nWrite-Output 'done'");
    let mut report = Vec::new();
    for (flag_name, flags) in [
        ("none", 0u32),
        ("DETACHED", 0x8),
        ("NO_WINDOW", 0x0800_0000),
        ("DETACHED|BREAKAWAY", 0x8 | 0x0100_0000),
    ] {
        for hidden in [false, true] {
            for stripped in [false, true] {
                let log = dir
                    .path()
                    .join(format!("{flag_name}-{hidden}-{stripped}.log").replace('|', "_"));
                let file = std::fs::File::create(&log).unwrap();
                let mut command = Command::new(&powershell);
                command.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass"]);
                if hidden {
                    command.args(["-WindowStyle", "Hidden"]);
                }
                command
                    .args(["-EncodedCommand", &script])
                    .stdin(Stdio::null())
                    .stdout(file.try_clone().unwrap())
                    .stderr(file)
                    .creation_flags(flags);
                if stripped {
                    command.env_clear();
                    for key in [
                        "SystemRoot",
                        "windir",
                        "SystemDrive",
                        "TEMP",
                        "TMP",
                        "PATHEXT",
                        "COMSPEC",
                    ] {
                        if let Some(value) = std::env::var_os(key) {
                            command.env(key, value);
                        }
                    }
                    command.env("PATH", std::path::PathBuf::from(&root).join("System32"));
                    command.env("USERPROFILE", dir.path());
                    command.env("HOME", dir.path());
                    command.env("APPDATA", dir.path().join("AppData").join("Roaming"));
                    command.env("LOCALAPPDATA", dir.path().join("AppData").join("Local"));
                }
                let status = command.spawn().and_then(|mut child| child.wait());
                let output = std::fs::read_to_string(&log).unwrap_or_default();
                report.push(format!(
                    "{flag_name:<20} hidden={hidden:<5} stripped={stripped:<5} -> {status:?} {:?}",
                    output.trim()
                ));
            }
        }
    }
    panic!("\n{}", report.join("\n"));
}
