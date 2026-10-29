//! Release packaging for quantex.
//!
//! ```text
//! quantex-release version --tag v2.0.0-beta.1
//! quantex-release package --version 2.0.0-beta.1 --binaries <dir> --out <dir>
//! quantex-release npm --version 2.0.0-beta.1 --binaries <dir> --out <dir> --readme README.md --license LICENSE
//! ```
//!
//! `<dir>` of binaries holds `quantex-darwin-arm64`, ..., `quantex-windows-x64.exe`.
//! `package` writes the GitHub release assets in the v1.13.6 format: one archive per
//! binary, `SHA256SUMS.txt`, and `manifest.json`. `npm` writes the `quantex-cli`
//! launcher package and one `quantex-cli-<platform>-<arch>` package per binary.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use quantex::archive::{self, RELEASE_BINARY_NAMES};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

const REPOSITORY: &str = "https://github.com/Drswith/quantex-cli";
const PACKAGE: &str = "quantex-cli";
const LAUNCHER: &str = include_str!("../npm/quantex.js");
const DESCRIPTION: &str = "Agent-friendly lifecycle CLI for AI coding assistant CLIs: install, inspect, update, uninstall, run, and automate Codex, Claude Code, Cursor, OpenCode, Pi, and more";
const KEYWORDS: [&str; 19] = [
    "agent-cli",
    "agent-lifecycle",
    "ai",
    "ai-agent",
    "ai-coding",
    "ai-coding-assistant",
    "automation",
    "claude-code",
    "cli",
    "codex",
    "coding-agent",
    "coding-assistant",
    "cursor-cli",
    "developer-tools",
    "machine-readable",
    "opencode",
    "qtx",
    "quantex",
    "self-upgrade",
];

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("version") => version(&Flags::parse(&args[1..])),
        Some("package") => package(&Flags::parse(&args[1..])),
        Some("npm") => npm(&Flags::parse(&args[1..])),
        _ => Err("usage: quantex-release <version|package|npm> [--flag value ...]".into()),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("quantex-release: {message}");
            ExitCode::FAILURE
        }
    }
}

struct Flags(BTreeMap<String, String>);

impl Flags {
    fn parse(args: &[String]) -> Self {
        let mut flags = BTreeMap::new();
        for pair in args.chunks(2) {
            if let [key, value] = pair
                && let Some(key) = key.strip_prefix("--")
            {
                flags.insert(key.to_owned(), value.clone());
            }
        }
        Self(flags)
    }

    fn get(&self, key: &str) -> Result<&str, String> {
        self.0
            .get(key)
            .map(String::as_str)
            .ok_or_else(|| format!("missing --{key}"))
    }

    fn path(&self, key: &str) -> Result<PathBuf, String> {
        self.get(key).map(PathBuf::from)
    }
}

fn io(context: impl std::fmt::Display) -> impl FnOnce(std::io::Error) -> String {
    move |error| format!("{context}: {error}")
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect()
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let text = format!("{}\n", serde_json::to_string_pretty(value).unwrap());
    fs::write(path, text).map_err(io(path.display()))
}

fn prerelease(version: &str) -> bool {
    version.contains('-')
}

/// Checks a release tag against the workspace version and prints the values the
/// release workflow needs, as `key=value` lines for `$GITHUB_OUTPUT`.
fn version(flags: &Flags) -> Result<(), String> {
    let tag = flags.get("tag")?;
    let version = tag
        .strip_prefix('v')
        .ok_or_else(|| format!("release tag must start with v: {tag}"))?;
    if version != quantex::VERSION {
        return Err(format!(
            "tag {tag} does not match the workspace version {}",
            quantex::VERSION
        ));
    }
    let prerelease = prerelease(version);
    println!("tag={tag}");
    println!("version={version}");
    println!("prerelease={prerelease}");
    // The beta channel upgrades npm and Bun installs from the `beta` dist-tag.
    println!("npm_tag={}", if prerelease { "beta" } else { "latest" });
    Ok(())
}

fn check_version(version: &str) -> Result<(), String> {
    if version != quantex::VERSION {
        return Err(format!(
            "version {version} does not match the workspace version {}",
            quantex::VERSION
        ));
    }
    Ok(())
}

fn read_binaries(dir: &Path) -> Result<Vec<(&'static str, Vec<u8>)>, String> {
    RELEASE_BINARY_NAMES
        .iter()
        .map(|name| {
            let path = dir.join(name);
            fs::read(&path).map(|bytes| (*name, bytes)).map_err(io(path.display()))
        })
        .collect()
}

/// v1 `resolveReleaseChannel`.
fn channel(version: &str) -> &'static str {
    if version.contains("beta") { "beta" } else { "stable" }
}

fn package(flags: &Flags) -> Result<(), String> {
    let version = flags.get("version")?;
    check_version(version)?;
    let out = flags.path("out")?;
    fs::create_dir_all(&out).map_err(io(out.display()))?;
    let mut checksums = Vec::new();
    let mut assets = Vec::new();
    for (binary, bytes) in read_binaries(&flags.path("binaries")?)? {
        let name = archive::archive_name(binary);
        let archive = archive::create(binary, &bytes)?;
        // The archive must be one v1.13.6 and this build both accept.
        if archive::extract(&archive, binary)? != bytes {
            return Err(format!("{name} does not round-trip"));
        }
        let (platform, arch) = archive::binary_target(binary).expect("release binary names are valid");
        let checksum = sha256_hex(&archive);
        assets.push(json!({
            "arch": arch,
            "checksum": checksum,
            "downloadUrl": format!("{REPOSITORY}/releases/download/v{version}/{name}"),
            "name": name,
            "platform": platform,
            "size": archive.len(),
        }));
        checksums.push(format!("{checksum}  {name}"));
        let path = out.join(&name);
        fs::write(&path, &archive).map_err(io(path.display()))?;
    }
    checksums.sort_by(|left, right| left.split_once("  ").unwrap().1.cmp(right.split_once("  ").unwrap().1));
    let path = out.join("SHA256SUMS.txt");
    fs::write(&path, format!("{}\n", checksums.join("\n"))).map_err(io(path.display()))?;
    assets.sort_by(|left, right| left["name"].as_str().cmp(&right["name"].as_str()));
    write_json(
        &out.join("manifest.json"),
        &json!({ "assets": assets, "channel": channel(version), "version": version }),
    )?;
    println!("wrote {} assets to {}", RELEASE_BINARY_NAMES.len() + 2, out.display());
    Ok(())
}

fn platform_package(binary: &str) -> (String, &'static str, &'static str) {
    let (platform, arch) = archive::binary_target(binary).expect("release binary names are valid");
    (format!("{PACKAGE}-{platform}-{arch}"), platform, arch)
}

#[cfg(unix)]
fn make_executable(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o755)).map_err(io(path.display()))
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn npm(flags: &Flags) -> Result<(), String> {
    let version = flags.get("version")?;
    check_version(version)?;
    let out = flags.path("out")?;
    let readme = fs::read_to_string(flags.path("readme")?).map_err(io("--readme"))?;
    let license = fs::read_to_string(flags.path("license")?).map_err(io("--license"))?;
    let repository = json!({ "type": "git", "url": format!("git+{REPOSITORY}.git") });
    let mut optional = serde_json::Map::new();
    for (binary, bytes) in read_binaries(&flags.path("binaries")?)? {
        let (name, platform, arch) = platform_package(binary);
        let dir = out.join(&name);
        let bin = dir.join("bin");
        fs::create_dir_all(&bin).map_err(io(bin.display()))?;
        let executable = bin.join(if platform == "win32" { "quantex.exe" } else { "quantex" });
        fs::write(&executable, bytes).map_err(io(executable.display()))?;
        make_executable(&executable)?;
        fs::write(dir.join("LICENSE"), &license).map_err(io("LICENSE"))?;
        fs::write(
            dir.join("README.md"),
            format!("# {name}\n\nThe `quantex` binary for {platform}-{arch}. Install [`{PACKAGE}`](https://www.npmjs.com/package/{PACKAGE}) instead of this package.\n"),
        )
        .map_err(io("README.md"))?;
        write_json(
            &dir.join("package.json"),
            &json!({
                "cpu": [arch],
                "description": format!("The quantex binary for {platform}-{arch}"),
                "files": ["bin"],
                "homepage": format!("{REPOSITORY}#readme"),
                "license": "Apache-2.0",
                "name": name,
                "os": [platform],
                "preferUnplugged": true,
                "repository": repository,
                "version": version,
            }),
        )?;
        optional.insert(name, version.into());
    }
    let dir = out.join(PACKAGE);
    let bin = dir.join("bin");
    fs::create_dir_all(&bin).map_err(io(bin.display()))?;
    let launcher = bin.join("quantex.js");
    fs::write(&launcher, LAUNCHER).map_err(io(launcher.display()))?;
    make_executable(&launcher)?;
    fs::write(dir.join("README.md"), readme).map_err(io("README.md"))?;
    fs::write(dir.join("LICENSE"), license).map_err(io("LICENSE"))?;
    write_json(
        &dir.join("package.json"),
        &json!({
            "bin": { "qtx": "bin/quantex.js", "quantex": "bin/quantex.js" },
            "description": DESCRIPTION,
            "engines": { "node": ">=18" },
            "files": ["bin"],
            "homepage": format!("{REPOSITORY}#readme"),
            "keywords": KEYWORDS,
            "license": "Apache-2.0",
            "name": PACKAGE,
            "optionalDependencies": optional,
            "repository": repository,
            "version": version,
        }),
    )?;
    println!(
        "wrote {} npm packages to {}",
        RELEASE_BINARY_NAMES.len() + 1,
        out.display()
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn binaries(dir: &Path) {
        for name in RELEASE_BINARY_NAMES {
            fs::write(dir.join(name), format!("binary {name}")).unwrap();
        }
    }

    fn flags(pairs: &[(&str, &Path)]) -> Flags {
        let mut args = Vec::new();
        for (key, value) in pairs {
            args.push(format!("--{key}"));
            args.push(value.to_string_lossy().into_owned());
        }
        args.extend(["--version".to_owned(), quantex::VERSION.to_owned()]);
        Flags::parse(&args)
    }

    #[test]
    fn package_writes_the_v1_asset_set() {
        let input = tempfile::tempdir().unwrap();
        let out = tempfile::tempdir().unwrap();
        binaries(input.path());
        package(&flags(&[("binaries", input.path()), ("out", out.path())])).unwrap();
        let mut names: Vec<String> = fs::read_dir(out.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        assert_eq!(
            names,
            [
                "SHA256SUMS.txt",
                "manifest.json",
                "quantex-darwin-arm64.tar.gz",
                "quantex-darwin-x64.tar.gz",
                "quantex-linux-arm64.tar.gz",
                "quantex-linux-x64.tar.gz",
                "quantex-windows-x64.exe.zip",
            ]
        );
        let sums = fs::read_to_string(out.path().join("SHA256SUMS.txt")).unwrap();
        let manifest: Value =
            serde_json::from_str(&fs::read_to_string(out.path().join("manifest.json")).unwrap()).unwrap();
        assert_eq!(manifest["version"], quantex::VERSION);
        let assets = manifest["assets"].as_array().unwrap();
        assert_eq!(assets.len(), 5);
        for (line, asset) in sums.lines().zip(assets) {
            let (checksum, name) = line.split_once("  ").unwrap();
            assert_eq!(asset["name"], name);
            assert_eq!(asset["checksum"], checksum);
            let bytes = fs::read(out.path().join(name)).unwrap();
            assert_eq!(sha256_hex(&bytes), checksum);
            assert_eq!(asset["size"], bytes.len());
            assert_eq!(
                asset["downloadUrl"],
                format!("{REPOSITORY}/releases/download/v{}/{name}", quantex::VERSION)
            );
        }
        assert_eq!(assets[4]["platform"], "win32");
    }

    #[test]
    fn npm_writes_a_launcher_and_platform_packages() {
        let input = tempfile::tempdir().unwrap();
        let out = tempfile::tempdir().unwrap();
        binaries(input.path());
        let readme = input.path().join("README.md");
        fs::write(&readme, "# quantex\n").unwrap();
        npm(&flags(&[
            ("binaries", input.path()),
            ("out", out.path()),
            ("readme", &readme),
            ("license", &readme),
        ]))
        .unwrap();
        let main: Value =
            serde_json::from_str(&fs::read_to_string(out.path().join("quantex-cli/package.json")).unwrap()).unwrap();
        assert_eq!(main["bin"]["qtx"], "bin/quantex.js");
        let optional = main["optionalDependencies"].as_object().unwrap();
        assert_eq!(optional.len(), 5);
        assert!(optional.contains_key("quantex-cli-win32-x64"));
        let windows: Value =
            serde_json::from_str(&fs::read_to_string(out.path().join("quantex-cli-win32-x64/package.json")).unwrap())
                .unwrap();
        assert_eq!(windows["os"], json!(["win32"]));
        assert_eq!(windows["cpu"], json!(["x64"]));
        assert!(out.path().join("quantex-cli-win32-x64/bin/quantex.exe").is_file());
        assert!(out.path().join("quantex-cli-linux-arm64/bin/quantex").is_file());
    }

    #[test]
    fn prerelease_versions_are_detected() {
        assert!(prerelease("2.0.0-alpha.1"));
        assert!(!prerelease("2.0.0"));
        assert_eq!(channel("2.0.0-beta.1"), "beta");
        assert_eq!(channel("2.0.0-alpha.1"), "stable");
    }
}
