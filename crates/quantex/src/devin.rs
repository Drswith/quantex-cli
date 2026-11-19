//! Devin's updater requires a terminal; its installer ends with an interactive login.

use std::cmp::Ordering;
use std::path::PathBuf;

use crate::catalog::Agent;
use crate::context::Context;
use crate::net::{self, DownloadError};
use crate::probe;
use crate::providers::{self, MutationFailure};

fn download(ctx: &Context, url: &str) -> Result<String, MutationFailure> {
    let bytes = net::download(ctx, url).map_err(|error| match error {
        DownloadError::TimedOut => MutationFailure::TimedOut,
        other => MutationFailure::Failed(format!("Could not fetch Devin release: {other:?}")),
    })?;
    String::from_utf8(bytes).map_err(|_| MutationFailure::Failed("Devin release is not UTF-8.".into()))
}

fn unattended_script(script: &str, version: &str, windows: bool) -> Result<String, MutationFailure> {
    let (pin, setup) = if windows {
        (format!("$PinnedVersion = \"{version}\""), "& $EntryExe setup")
    } else {
        (
            format!("PINNED_VERSION=\"{version}\""),
            "\"$VERSION_DIR/bin/$COMPILED_BIN_NAME\" setup",
        )
    };
    let script = script.trim_end();
    let body = script.strip_suffix(setup).filter(|body| body.ends_with('\n'));
    if !script.lines().any(|line| line.trim() == pin) || body.is_none() {
        return Err(MutationFailure::Failed(
            "Devin's installer layout changed; refusing to run it without a verified version pin and final setup step."
                .into(),
        ));
    }
    // Keep the official download, checksum, extraction and PATH logic; defer only login.
    Ok(body.unwrap().to_owned())
}

pub(crate) fn install(ctx: &Context, agent: &Agent, before: Option<&str>) -> Result<(), MutationFailure> {
    if ctx.is_cancelled() {
        return Err(MutationFailure::Cancelled);
    }
    if before.is_some() {
        let distribution = probe::resolve_executable(&probe::lookup_names(agent))
            .map(|path| probe::real_path(&path))
            .and_then(|path| path.parent()?.parent().map(|root| root.join("distribution")))
            .and_then(|path| std::fs::read_to_string(path).ok());
        if !matches!(distribution.as_deref().map(str::trim), Some("curl-bash" | "irm-iex")) {
            return Err(MutationFailure::Failed(
                "Devin is not a confirmed public installer distribution; run `devin update` in a terminal.".into(),
            ));
        }
    }
    // Test servers use the same versioned manifest and installer paths as the vendor.
    let base = std::env::var("QUANTEX_DEVIN_BASE_URL").unwrap_or_else(|_| "https://static.devin.ai/cli".into());
    let base = base.trim_end_matches('/');
    let manifest: serde_json::Value = serde_json::from_str(&download(ctx, &format!("{base}/current/manifest.json"))?)
        .map_err(|_| MutationFailure::Failed("Invalid Devin release manifest.".into()))?;
    let version = manifest["version"]
        .as_str()
        .filter(|v| {
            v.as_bytes().first().is_some_and(u8::is_ascii_digit)
                && v.len() < 128
                && v.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'.' || c == b'-')
        })
        .ok_or_else(|| MutationFailure::Failed("Invalid Devin release version.".into()))?;
    if let Some(before) = before {
        match probe::compare_versions(version, before) {
            Some(Ordering::Less | Ordering::Equal) => return Ok(()),
            Some(Ordering::Greater) => {}
            None => {
                return Err(MutationFailure::Failed(
                    "Cannot safely compare Devin release versions.".into(),
                ));
            }
        }
    }
    let extension = if cfg!(windows) { "ps1" } else { "sh" };
    let script = download(ctx, &format!("{base}/{version}/setup.{extension}"))?;
    let script = unattended_script(&script, version, cfg!(windows))?;
    if ctx.is_cancelled() {
        return Err(MutationFailure::Cancelled);
    }
    let command = if cfg!(windows) {
        let powershell = std::env::var_os("SystemRoot")
            .map(|root| PathBuf::from(root).join(r"System32\WindowsPowerShell\v1.0\powershell.exe"))
            .unwrap_or_else(|| PathBuf::from("powershell.exe"));
        vec![
            powershell.to_string_lossy().into_owned(),
            "-NoProfile".into(),
            "-NonInteractive".into(),
            "-Command".into(),
            script,
        ]
    } else {
        vec!["bash".into(), "-c".into(), script]
    };
    providers::run_mutation(ctx, &command, "Devin installer failed")?;
    if ctx.is_cancelled() {
        return Err(MutationFailure::Cancelled);
    }
    let observed = probe::resolve_executable(&probe::lookup_names(agent))
        .and_then(|path| probe::probe_version(ctx, agent, Some(&path)));
    if observed
        .as_deref()
        .and_then(|found| probe::compare_versions(found, version))
        .is_none_or(|order| order == Ordering::Less)
    {
        return Err(MutationFailure::Failed(format!(
            "Devin installer did not produce target {version}; observed {}.",
            observed.as_deref().unwrap_or("unknown")
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_expected_final_setup_step_is_removed() {
        for (windows, pin, setup) in [
            (
                false,
                "PINNED_VERSION=\"1.2.3\"",
                "\"$VERSION_DIR/bin/$COMPILED_BIN_NAME\" setup",
            ),
            (true, "$PinnedVersion = \"1.2.3\"", "& $EntryExe setup"),
        ] {
            let body = format!("{pin}\n# checksum and installation stay here\n");
            assert_eq!(
                unattended_script(&format!("{body}{setup}\r\n"), "1.2.3", windows).unwrap(),
                body
            );
            assert!(unattended_script(&format!("{body}{setup}\nmore-work"), "1.2.3", windows).is_err());
            assert!(unattended_script(&format!("{body}{setup}"), "9.9.9", windows).is_err());
            assert!(unattended_script(&format!("{body}unexpected setup"), "1.2.3", windows).is_err());
        }
    }
}
