//! Harness for black-box contract tests.
//!
//! Every test spawns a quantex binary in an isolated home directory. The binary is
//! `QUANTEX_BIN` when set, otherwise the workspace build of `quantex`, compiled on
//! first use.

use std::collections::BTreeMap;
use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::OnceLock;

use serde_json::Value;
use tempfile::TempDir;

/// Path to the binary under test.
pub fn quantex_bin() -> &'static Path {
    static BIN: OnceLock<PathBuf> = OnceLock::new();
    BIN.get_or_init(|| {
        if let Some(path) = std::env::var_os("QUANTEX_BIN") {
            return PathBuf::from(path);
        }
        build_workspace_binary()
    })
}

fn build_workspace_binary() -> PathBuf {
    let cargo = std::env::var_os("CARGO").unwrap_or_else(|| "cargo".into());
    let workspace = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    // A separate target directory: `cargo build -p quantex` resolves features differently
    // from the surrounding `cargo test --workspace`, and sharing one directory would make
    // each of them rebuild the other's artifacts.
    let target = std::env::var_os("CARGO_TARGET_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| workspace.join("target"))
        .join("contract-bin");
    let status = Command::new(cargo)
        .args(["build", "--quiet", "-p", "quantex", "--bin", "quantex", "--target-dir"])
        .arg(&target)
        .current_dir(&workspace)
        .status()
        .expect("failed to run cargo build for the quantex binary");
    assert!(status.success(), "cargo build -p quantex failed");
    target
        .join("debug")
        .join(format!("quantex{}", std::env::consts::EXE_SUFFIX))
}

/// Output of one quantex invocation.
#[derive(Debug)]
pub struct Run {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

impl Run {
    /// Parses stdout as one JSON document.
    pub fn json(&self) -> Value {
        serde_json::from_str(&self.stdout)
            .unwrap_or_else(|error| panic!("stdout is not JSON ({error}):\n{}", self.stdout))
    }
}

/// A URL nothing listens on.
pub const OFFLINE_URL: &str = "http://127.0.0.1:9";

/// An isolated environment: a temporary home, a private bin directory on `PATH`,
/// and a config that disables network retries.
pub struct Sandbox {
    root: TempDir,
    env: BTreeMap<String, String>,
}

impl Default for Sandbox {
    fn default() -> Self {
        Self::new()
    }
}

impl Sandbox {
    pub fn new() -> Self {
        let root = tempfile::Builder::new()
            .prefix("quantex-contract-")
            .tempdir()
            .expect("failed to create sandbox directory");
        // Rust-build test hooks; the reference binary ignores them. A closed local port
        // keeps lookups off the real network.
        let mut env = BTreeMap::new();
        env.insert("QUANTEX_NPM_REGISTRY_URL".to_owned(), OFFLINE_URL.to_owned());
        env.insert("QUANTEX_RELEASE_BASE_URL".to_owned(), OFFLINE_URL.to_owned());
        let sandbox = Self { root, env };
        fs::create_dir_all(sandbox.bin_dir()).unwrap();
        fs::create_dir_all(sandbox.quantex_dir()).unwrap();
        sandbox.write_config(&serde_json::json!({ "networkTimeoutMs": 1 }));
        sandbox
    }

    pub fn home(&self) -> PathBuf {
        self.root.path().join("home")
    }

    pub fn bin_dir(&self) -> PathBuf {
        self.root.path().join("bin")
    }

    pub fn quantex_dir(&self) -> PathBuf {
        self.home().join(".quantex")
    }

    pub fn write_config(&self, config: &Value) {
        fs::write(
            self.quantex_dir().join("config.json"),
            format!("{}\n", serde_json::to_string_pretty(config).unwrap()),
        )
        .unwrap();
    }

    pub fn write_state(&self, contents: &str) {
        fs::write(self.quantex_dir().join("state.json"), contents).unwrap();
    }

    pub fn read_state(&self) -> Option<Value> {
        let text = fs::read_to_string(self.quantex_dir().join("state.json")).ok()?;
        serde_json::from_str(&text).ok()
    }

    /// Sets an extra environment variable for every run.
    pub fn env(&mut self, key: &str, value: &str) -> &mut Self {
        self.env.insert(key.to_owned(), value.to_owned());
        self
    }

    /// Installs a fake executable named `name` on the sandbox `PATH`. On Unix the body
    /// is a POSIX shell script; on Windows it is a batch file.
    pub fn fake_tool(&self, name: &str, unix_script: &str, windows_batch: &str) -> PathBuf {
        if cfg!(windows) {
            let path = self.bin_dir().join(format!("{name}.cmd"));
            fs::write(&path, format!("@echo off\r\n{windows_batch}\r\n")).unwrap();
            path
        } else {
            let path = self.bin_dir().join(name);
            fs::write(&path, format!("#!/bin/sh\n{unix_script}\n")).unwrap();
            make_executable(&path);
            path
        }
    }

    fn path_value(&self) -> String {
        let mut dirs = vec![self.bin_dir()];
        if cfg!(windows) {
            if let Some(system_root) = std::env::var_os("SystemRoot") {
                let system_root = PathBuf::from(system_root);
                dirs.push(system_root.join("System32"));
                dirs.push(system_root.clone());
            }
        } else {
            dirs.push(PathBuf::from("/usr/bin"));
            dirs.push(PathBuf::from("/bin"));
        }
        std::env::join_paths(dirs).unwrap().to_string_lossy().into_owned()
    }

    /// Runs quantex with `args` and stdin closed.
    pub fn run<I, S>(&self, args: I) -> Run
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        self.run_program(quantex_bin(), args)
    }

    /// A private copy of the binary under test, for commands that replace their own
    /// executable.
    pub fn copy_quantex(&self) -> PathBuf {
        let dir = self.root().join("app");
        fs::create_dir_all(&dir).unwrap();
        let name = if cfg!(windows) { "quantex.exe" } else { "quantex" };
        let copy = dir.join(name);
        fs::copy(quantex_bin(), &copy).unwrap();
        make_executable(&copy);
        copy
    }

    /// Runs `program` in the sandbox, as `run` runs quantex.
    pub fn run_program<I, S>(&self, program: &Path, args: I) -> Run
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        let home = self.home();
        let mut command = Command::new(program);
        command
            .args(args)
            .env_clear()
            .env("HOME", &home)
            .env("USERPROFILE", &home)
            .env("PATH", self.path_value())
            .env("NO_COLOR", "1")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        // Process-level system variables; Windows PowerShell, which a Windows upgrade
        // starts, needs several of them.
        for key in [
            "SystemRoot",
            "SYSTEMROOT",
            "SystemDrive",
            "windir",
            "ProgramFiles",
            "ProgramFiles(x86)",
            "ProgramW6432",
            "ProgramData",
            "CommonProgramFiles",
            "ALLUSERSPROFILE",
            "PROCESSOR_ARCHITECTURE",
            "NUMBER_OF_PROCESSORS",
            "OS",
            "TEMP",
            "TMP",
            "TMPDIR",
            "PATHEXT",
            "COMSPEC",
        ] {
            if let Some(value) = std::env::var_os(key) {
                command.env(key, value);
            }
        }
        if cfg!(windows) {
            command.env("APPDATA", home.join("AppData").join("Roaming"));
            command.env("LOCALAPPDATA", home.join("AppData").join("Local"));
        }
        for (key, value) in &self.env {
            command.env(key, value);
        }
        // A binary copied a moment ago can be briefly busy on Linux while another test
        // thread forks; retry instead of failing on that race.
        let mut attempts = 0;
        let output = loop {
            match command.output() {
                Err(error) if error.kind() == std::io::ErrorKind::ExecutableFileBusy && attempts < 50 => {
                    attempts += 1;
                    std::thread::sleep(std::time::Duration::from_millis(20));
                }
                result => break result.expect("failed to spawn the quantex binary"),
            }
        };
        Run {
            code: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        }
    }
}

#[cfg(unix)]
fn make_executable(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let mut permissions = fs::metadata(path).unwrap().permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions).unwrap();
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) {}

/// Replaces values that legitimately differ between runs and implementations, so two
/// envelopes can be compared structurally.
pub fn normalize(value: &Value) -> Value {
    normalize_with_key(value, None)
}

fn normalize_with_key(value: &Value, key: Option<&str>) -> Value {
    match value {
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(child_key, child)| (child_key.clone(), normalize_with_key(child, Some(child_key))))
                .collect(),
        ),
        Value::Array(items) => Value::Array(items.iter().map(|item| normalize_with_key(item, None)).collect()),
        Value::String(_) => match key {
            Some(name @ ("timestamp" | "fetchedAt" | "staleAfter")) => Value::String(format!("<{name}>")),
            Some("version" | "currentVersion" | "latestVersion") => Value::String("<version>".into()),
            _ => value.clone(),
        },
        _ => value.clone(),
    }
}

/// Asserts the envelope invariants every structured result must satisfy.
pub fn assert_envelope(envelope: &Value, action: &str) {
    assert_eq!(envelope["action"], action, "action in {envelope}");
    assert!(envelope["ok"].is_boolean(), "ok must be boolean in {envelope}");
    assert_eq!(envelope["meta"]["mode"], "json", "meta.mode in {envelope}");
    assert_eq!(
        envelope["meta"]["schemaVersion"], "1",
        "meta.schemaVersion in {envelope}"
    );
    assert!(envelope["meta"].get("runId").is_none(), "meta.runId in {envelope}");
    assert!(
        envelope["meta"]["timestamp"].is_string(),
        "meta.timestamp in {envelope}"
    );
    assert!(envelope["meta"]["version"].is_string(), "meta.version in {envelope}");
    assert!(envelope["warnings"].is_array(), "warnings in {envelope}");
    if envelope["ok"] == true {
        assert!(
            envelope["error"].is_null(),
            "error must be null on success in {envelope}"
        );
    } else {
        assert!(envelope["error"]["code"].is_string(), "error.code in {envelope}");
        assert!(envelope["error"]["message"].is_string(), "error.message in {envelope}");
    }
}

/// Root of the repository `contract/` directory.
pub fn contract_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../contract")
}

/// Reads a JSON file under `contract/`.
pub fn contract_json(relative: &str) -> Value {
    let path = contract_dir().join(relative);
    let text = fs::read_to_string(&path).unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|error| panic!("{} is not JSON: {error}", path.display()))
}

/// A tiny HTTP/1.1 server answering fixed routes, for registry and release lookups.
pub struct HttpStub {
    address: String,
    hits: std::sync::Arc<std::sync::Mutex<Vec<String>>>,
}

impl HttpStub {
    /// Serves `routes` (path → (status, body)) until the stub is dropped with the test.
    pub fn start(routes: Vec<(&str, u16, &str)>) -> Self {
        Self::serve(
            routes
                .into_iter()
                .map(|(path, status, body)| (path.to_owned(), status, body.as_bytes().to_vec()))
                .collect(),
        )
    }

    /// `start` with binary bodies.
    pub fn serve(routes: Vec<(String, u16, Vec<u8>)>) -> Self {
        use std::io::{BufRead, BufReader, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        let hits = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let recorded = std::sync::Arc::clone(&hits);
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { continue };
                let mut reader = BufReader::new(stream.try_clone().unwrap());
                let mut request_line = String::new();
                if reader.read_line(&mut request_line).is_err() {
                    continue;
                }
                loop {
                    let mut header = String::new();
                    if reader.read_line(&mut header).is_err() || header.trim().is_empty() {
                        break;
                    }
                }
                let path = request_line.split_whitespace().nth(1).unwrap_or("/").to_owned();
                recorded.lock().unwrap().push(path.clone());
                let (status, body) = routes
                    .iter()
                    .find(|(route, _, _)| *route == path)
                    .map_or((404, b"{}".to_vec()), |(_, status, body)| (*status, body.clone()));
                let head = format!(
                    "HTTP/1.1 {status} OK\r\nContent-Type: application/octet-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                let _ = stream.write_all(head.as_bytes());
                let _ = stream.write_all(&body);
            }
        });
        Self { address, hits }
    }

    pub fn url(&self) -> &str {
        &self.address
    }

    /// Paths requested so far.
    pub fn hits(&self) -> Vec<String> {
        self.hits.lock().unwrap().clone()
    }
}

/// The canonical form of a path, as quantex reports resolved executables.
pub fn real_path(path: &Path) -> String {
    let resolved = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let text = resolved.to_string_lossy().into_owned();
    text.strip_prefix(r"\\?\").map(str::to_owned).unwrap_or(text)
}

/// Writes a fake agent that prints `version_line` for any arguments.
pub fn fake_agent(sandbox: &Sandbox, name: &str, version_line: &str) -> PathBuf {
    sandbox.fake_tool(
        name,
        &format!("echo \"{version_line}\""),
        &format!("echo {version_line}"),
    )
}

/// A stateful fake `npm` for lifecycle tests. `install -g <pkg>` and `update -g <pkg>`
/// create the package's executable in the sandbox bin directory, `uninstall -g` removes
/// it, `list -g` reports it, and every call is appended to `npm-calls.log` in the sandbox
/// root. Packages install at 0.50.0, or at the version in `npm-next-version`; an
/// `npm-fail` file makes installs and updates fail.
/// Unix only: Windows lifecycle cases need batch equivalents.
pub fn fake_npm(sandbox: &Sandbox) {
    let script = r#"ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "npm $*" >> "$ROOT/npm-calls.log"
bin_for() { case "$1" in @openai/codex*) echo codex;; @kilocode/cli*) echo kilo;; @anthropic-ai/claude-code*) echo claude;; *) echo "";; esac; }
put() {
  pkg="$1"; b=$(bin_for "$pkg"); [ -n "$b" ] || exit 1
  [ -f "$ROOT/npm-fail" ] && { echo "npm error fake failure for $pkg" >&2; exit 1; }
  v=$(cat "$ROOT/npm-next-version" 2>/dev/null || echo 0.50.0)
  printf '#!/bin/sh\necho "%s %s"\n' "$b" "$v" > "$ROOT/bin/$b"; chmod +x "$ROOT/bin/$b"
  grep -q -x "$pkg" "$ROOT/npm-installed.txt" 2>/dev/null || echo "$pkg" >> "$ROOT/npm-installed.txt"
  echo "$v" > "$ROOT/npm-version-$b"
}
case "$1" in
  --version) echo 10.9.0 ;;
  install|i) for a in "$@"; do case "$a" in @*) put "${a%@latest}";; esac; done; echo "changed 1 package (fake npm)" ;;
  update) put "$3" ;;
  uninstall)
    pkg="$3"; b=$(bin_for "$pkg"); rm -f "$ROOT/bin/$b"
    grep -v -x "$pkg" "$ROOT/npm-installed.txt" > "$ROOT/npm-installed.tmp" 2>/dev/null; mv "$ROOT/npm-installed.tmp" "$ROOT/npm-installed.txt" ;;
  list|ls)
    if grep -q -x "$3" "$ROOT/npm-installed.txt" 2>/dev/null; then
      v=$(cat "$ROOT/npm-version-$(bin_for "$3")" 2>/dev/null || echo 0.50.0)
      printf '{"dependencies":{"%s":{"version":"%s"}}}\n' "$3" "$v"
    else echo '{}'; fi ;;
esac
exit 0"#;
    sandbox.fake_tool("npm", script, "exit /b 1");
}

/// Stores `body` under `key` in the response cache, fresh for an hour.
pub fn seed_cache(sandbox: &Sandbox, key: &str, body: &str) {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let path = sandbox.quantex_dir().join("cache").join("versions.json");
    let mut cache: Value = fs::read_to_string(&path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_else(|| serde_json::json!({ "entries": {} }));
    cache["entries"][key] = serde_json::json!({ "body": body, "expiresAt": now + 3_600_000, "fetchedAt": now });
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, serde_json::to_string_pretty(&cache).unwrap()).unwrap();
}

/// A release `.tar.gz` holding one executable `name` with `contents`.
pub fn release_tar_gz(name: &str, contents: &[u8]) -> Vec<u8> {
    use std::io::Write;
    let mut header = [0u8; 512];
    header[..name.len()].copy_from_slice(name.as_bytes());
    header[100..108].copy_from_slice(b"0000755\0");
    header[108..116].copy_from_slice(b"0000000\0");
    header[116..124].copy_from_slice(b"0000000\0");
    header[124..136].copy_from_slice(format!("{:011o}\0", contents.len()).as_bytes());
    header[136..148].copy_from_slice(b"00000000000\0");
    header[156] = b'0';
    header[257..263].copy_from_slice(b"ustar\0");
    header[263..265].copy_from_slice(b"00");
    header[148..156].fill(b' ');
    let checksum: u32 = header.iter().map(|&byte| u32::from(byte)).sum();
    header[148..156].copy_from_slice(format!("{checksum:06o}\0 ").as_bytes());
    let mut tar = header.to_vec();
    tar.extend_from_slice(contents);
    tar.resize(tar.len() + (512 - contents.len() % 512) % 512 + 1024, 0);
    let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
    encoder.write_all(&tar).unwrap();
    encoder.finish().unwrap()
}

/// A release `.zip` holding one stored (uncompressed) entry `name` with `contents`,
/// in the layout releases use: no data descriptor, one central directory record.
pub fn release_zip(name: &str, contents: &[u8]) -> Vec<u8> {
    let crc = {
        let mut crc = 0xffff_ffffu32;
        for &byte in contents {
            crc ^= u32::from(byte);
            for _ in 0..8 {
                crc = if crc & 1 == 0 {
                    crc >> 1
                } else {
                    (crc >> 1) ^ 0xedb8_8320
                };
            }
        }
        crc ^ 0xffff_ffff
    };
    let size = contents.len() as u32;
    let name_length = name.len() as u16;
    let mut zip = Vec::new();
    zip.extend_from_slice(&0x0403_4b50u32.to_le_bytes());
    zip.extend_from_slice(&[20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    zip.extend_from_slice(&crc.to_le_bytes());
    zip.extend_from_slice(&size.to_le_bytes());
    zip.extend_from_slice(&size.to_le_bytes());
    zip.extend_from_slice(&name_length.to_le_bytes());
    zip.extend_from_slice(&[0, 0]);
    zip.extend_from_slice(name.as_bytes());
    zip.extend_from_slice(contents);
    let central = zip.len() as u32;
    zip.extend_from_slice(&0x0201_4b50u32.to_le_bytes());
    zip.extend_from_slice(&[20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    zip.extend_from_slice(&crc.to_le_bytes());
    zip.extend_from_slice(&size.to_le_bytes());
    zip.extend_from_slice(&size.to_le_bytes());
    zip.extend_from_slice(&name_length.to_le_bytes());
    zip.extend_from_slice(&[0; 12]);
    zip.extend_from_slice(&0u32.to_le_bytes());
    zip.extend_from_slice(name.as_bytes());
    let central_size = zip.len() as u32 - central;
    zip.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
    zip.extend_from_slice(&[0, 0, 0, 0, 1, 0, 1, 0]);
    zip.extend_from_slice(&central_size.to_le_bytes());
    zip.extend_from_slice(&central.to_le_bytes());
    zip.extend_from_slice(&[0, 0]);
    zip
}

/// Lowercase hex SHA-256.
pub fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::Digest;
    sha2::Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Seeds the version cache so the `latest` dist-tag of `package` resolves to `version`
/// without a network lookup, under both the official registry and the offline test hook.
pub fn seed_latest_version(sandbox: &Sandbox, package: &str, version: &str) {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let path = sandbox.quantex_dir().join("cache").join("versions.json");
    let mut cache: Value = fs::read_to_string(&path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_else(|| serde_json::json!({ "entries": {} }));
    for registry in ["https://registry.npmjs.org", OFFLINE_URL] {
        cache["entries"][format!("npm:{registry}:{package}:latest")] = serde_json::json!({
            "body": serde_json::json!({ "version": version }).to_string(),
            "expiresAt": now + 3_600_000,
            "fetchedAt": now,
        });
    }
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, serde_json::to_string_pretty(&cache).unwrap()).unwrap();
}

impl Sandbox {
    /// The sandbox root: `home/`, `bin/`, and fake-tool logs live here.
    pub fn root(&self) -> PathBuf {
        self.root.path().to_path_buf()
    }

    /// Lines the fake `npm` logged.
    pub fn npm_calls(&self) -> Vec<String> {
        fs::read_to_string(self.root().join("npm-calls.log"))
            .unwrap_or_default()
            .lines()
            .map(str::to_owned)
            .collect()
    }
}
