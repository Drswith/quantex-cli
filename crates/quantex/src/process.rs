//! Child processes: spawning with timeouts, capturing output, and killing everything
//! still running when a command is cancelled.

use std::ffi::OsStr;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

static TRACKED: Mutex<Vec<u32>> = Mutex::new(Vec::new());

fn track(pid: u32) {
    TRACKED.lock().unwrap().push(pid);
}

fn untrack(pid: u32) {
    TRACKED.lock().unwrap().retain(|&tracked| tracked != pid);
}

/// Kills every child started through this module that is still running.
pub fn kill_tracked_children() {
    let pids: Vec<u32> = TRACKED.lock().unwrap().drain(..).collect();
    for pid in pids {
        kill_pid(pid);
    }
}

#[cfg(unix)]
fn kill_pid(pid: u32) {
    // SAFETY: kill(2) has no memory-safety preconditions.
    unsafe {
        libc::kill(pid as libc::pid_t, libc::SIGTERM);
    }
}

#[cfg(windows)]
fn kill_pid(pid: u32) {
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

/// Captured output of a finished process.
#[derive(Debug, Clone)]
pub struct Captured {
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
}

impl Captured {
    pub fn success(&self) -> bool {
        self.code == Some(0) && !self.timed_out
    }
}

/// Builds a command for `program`, resolving Windows `.cmd` / `.bat` shims, which
/// `CreateProcess` cannot start directly.
pub fn command_for(program: &Path) -> Command {
    #[cfg(windows)]
    {
        let is_script = program
            .extension()
            .and_then(OsStr::to_str)
            .is_some_and(|extension| extension.eq_ignore_ascii_case("cmd") || extension.eq_ignore_ascii_case("bat"));
        if is_script {
            let mut command = Command::new(std::env::var_os("COMSPEC").unwrap_or_else(|| "cmd.exe".into()));
            command.arg("/d").arg("/s").arg("/c").arg(program);
            return command;
        }
    }
    Command::new(program)
}

/// Runs a program to completion with captured output, killing it after `timeout`.
pub fn run_captured<I, S>(program: &Path, args: I, timeout: Option<Duration>) -> std::io::Result<Captured>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let mut command = command_for(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    run_command_captured(command, timeout)
}

/// Runs a prepared command to completion with captured output.
pub fn run_command_captured(mut command: Command, timeout: Option<Duration>) -> std::io::Result<Captured> {
    let mut child = command.spawn()?;
    let pid = child.id();
    track(pid);
    let result = wait_captured(&mut child, timeout);
    untrack(pid);
    result
}

fn wait_captured(child: &mut Child, timeout: Option<Duration>) -> std::io::Result<Captured> {
    let mut stdout = child.stdout.take();
    let mut stderr = child.stderr.take();
    let out_reader = std::thread::spawn(move || {
        let mut buffer = Vec::new();
        if let Some(stream) = stdout.as_mut() {
            let _ = stream.read_to_end(&mut buffer);
        }
        buffer
    });
    let err_reader = std::thread::spawn(move || {
        let mut buffer = Vec::new();
        if let Some(stream) = stderr.as_mut() {
            let _ = stream.read_to_end(&mut buffer);
        }
        buffer
    });
    let started = Instant::now();
    let mut timed_out = false;
    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if timeout.is_some_and(|limit| started.elapsed() >= limit) {
            let _ = child.kill();
            timed_out = true;
            break child.wait()?;
        }
        std::thread::sleep(Duration::from_millis(5));
    };
    let stdout = out_reader.join().unwrap_or_default();
    let stderr = err_reader.join().unwrap_or_default();
    Ok(Captured {
        code: status.code(),
        stdout: String::from_utf8_lossy(&stdout).into_owned(),
        stderr: String::from_utf8_lossy(&stderr).into_owned(),
        timed_out,
    })
}

/// Runs a command with inherited stdio and returns its exit code.
pub fn run_inherited(mut command: Command) -> std::io::Result<Option<i32>> {
    let mut child = command.spawn()?;
    let pid = child.id();
    track(pid);
    let status = child.wait();
    untrack(pid);
    Ok(status?.code())
}

/// Every directory on `PATH`, in order.
pub fn path_dirs() -> Vec<PathBuf> {
    std::env::var_os("PATH")
        .map(|value| {
            std::env::split_paths(&value)
                .filter(|dir| !dir.as_os_str().is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn executable_extensions() -> Vec<String> {
    if cfg!(windows) {
        let pathext = std::env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".into());
        pathext
            .split(';')
            .filter(|extension| !extension.is_empty())
            .map(|extension| extension.to_ascii_lowercase())
            .collect()
    } else {
        vec![String::new()]
    }
}

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

/// Finds `name` in `dirs`, honouring `PATHEXT` on Windows.
pub fn find_in(name: &str, dirs: &[PathBuf]) -> Option<PathBuf> {
    if name.is_empty() {
        return None;
    }
    let extensions = executable_extensions();
    let has_extension = cfg!(windows) && Path::new(name).extension().is_some();
    for dir in dirs {
        if has_extension {
            let candidate = dir.join(name);
            if is_executable(&candidate) {
                return Some(candidate);
            }
        }
        for extension in &extensions {
            let candidate = dir.join(format!("{name}{extension}"));
            if is_executable(&candidate) {
                return Some(candidate);
            }
        }
    }
    None
}

/// Finds `name` on `PATH`.
pub fn which(name: &str) -> Option<PathBuf> {
    find_in(name, &path_dirs())
}
