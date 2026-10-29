//! Package managers and installers: availability, presence probes, and the commands
//! that install, update, and uninstall a provider target.

use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;

use serde_json::Value;

use crate::catalog::{Agent, InstallMethod, Provider};
use crate::context::Context;
use crate::process;
use crate::store::InstalledAgent;

/// Default bound for one read-only provider probe.
const PROBE_BUDGET: Duration = Duration::from_secs(60);

/// What a provider installs: a package, formula, cask, tool, id, script, or binary.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderTarget {
    pub id: String,
    pub kind: &'static str,
    pub arguments: Vec<String>,
    pub binary_name: Option<String>,
}

/// A provider and the target it manages for one agent.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Binding {
    pub provider: Provider,
    pub target: ProviderTarget,
}

fn target_kind(provider: Provider, package_target_kind: Option<&str>) -> &'static str {
    match provider {
        Provider::Binary => "binary",
        Provider::Brew => {
            if package_target_kind == Some("cask") {
                "cask"
            } else {
                "formula"
            }
        }
        Provider::Script => "script",
        Provider::Winget => "id",
        Provider::Bun | Provider::Npm => "package",
    }
}

impl Binding {
    /// v1 `resolveStateProviderBinding`.
    pub fn from_installed(agent: &Agent, state: &InstalledAgent) -> Option<Self> {
        let provider = state.install_type;
        let id = state
            .package_name
            .clone()
            .filter(|name| !name.is_empty())
            .or_else(|| state.command.clone())
            .or_else(|| state.binary_name.clone())
            .or_else(|| match provider {
                Provider::Binary | Provider::Script => Some(agent.binary_name.clone()),
                Provider::Brew | Provider::Winget => None,
                other => agent.package_for(other).map(str::to_owned),
            })?;
        let binary_name = if state.binary_name.is_some() || matches!(provider, Provider::Binary | Provider::Script) {
            Some(state.binary_name.clone().unwrap_or_else(|| agent.binary_name.clone()))
        } else {
            None
        };
        Some(Self {
            provider,
            target: ProviderTarget {
                id,
                kind: target_kind(provider, state.package_target_kind.as_deref()),
                arguments: state.package_install_args.clone().unwrap_or_default(),
                binary_name,
            },
        })
    }

    /// v1 `resolveInstallMethodProviderBinding`.
    pub fn from_method(agent: &Agent, method: &InstallMethod) -> Option<Self> {
        Self::from_installed(agent, &installed_state_for_method(agent, method, false))
    }

    /// v1 `resolveReceiptProviderBinding`.
    pub fn from_receipt(receipt: &Value) -> Option<Self> {
        let provider = Provider::parse(receipt["providerId"].as_str()?)?;
        let id = receipt["providerTargetId"].as_str().filter(|id| !id.is_empty())?;
        let kind = receipt["providerTargetKind"].as_str();
        if provider == Provider::Brew && !matches!(kind, Some("cask" | "formula")) {
            return None;
        }
        let kind = match kind {
            Some("cask") => "cask",
            Some("formula") => "formula",
            Some("package") => "package",
            Some("id") => "id",
            Some("script") => "script",
            Some("binary") => "binary",
            _ => target_kind(provider, None),
        };
        Some(Self {
            provider,
            target: ProviderTarget {
                id: id.to_owned(),
                kind,
                arguments: Vec::new(),
                binary_name: receipt["executableName"].as_str().map(str::to_owned),
            },
        })
    }

    /// v1 `providerBindingsEqual`: provider, target id and kind, and executable name
    /// (defaulting to the agent's binary).
    pub fn same_source(&self, other: &Binding, default_executable: &str) -> bool {
        self.provider == other.provider
            && self.target.id == other.target.id
            && self.target.kind == other.target.kind
            && self.target.binary_name.as_deref().unwrap_or(default_executable)
                == other.target.binary_name.as_deref().unwrap_or(default_executable)
    }
}

/// v1 `buildInstalledAgentState`: the `installedAgents` record for a method.
pub fn installed_state_for_method(agent: &Agent, method: &InstallMethod, _recorded: bool) -> InstalledAgent {
    let binary_name = method.binary_name.clone();
    InstalledAgent {
        agent_name: agent.name.clone(),
        install_type: method.kind,
        binary_name,
        package_install_args: (!method.package_install_args.is_empty()).then(|| method.package_install_args.clone()),
        package_name: crate::observe::method_package(agent, method),
        package_target_kind: method.package_target_kind.clone(),
        command: method.command.clone(),
    }
}

/// Catalog bindings for this platform, deduplicated by source.
pub fn catalog_bindings(agent: &Agent) -> Vec<Binding> {
    let mut bindings: Vec<Binding> = Vec::new();
    for method in agent.install_methods() {
        if let Some(binding) = Binding::from_method(agent, &method)
            && !bindings
                .iter()
                .any(|existing| existing.same_source(&binding, &agent.binary_name))
        {
            bindings.push(binding);
        }
    }
    bindings
}

/// The result of probing one provider target.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Observed {
    Present {
        version: Option<String>,
    },
    Absent,
    /// The provider's executable is not installed.
    Unavailable(String),
    /// The provider ran but could not say.
    Indeterminate(String),
    /// The probe itself failed.
    Failed(String),
    TimedOut,
}

impl Observed {
    /// Inconclusive in v1's sense: not a success and not merely unavailable.
    pub fn is_inconclusive(&self) -> bool {
        matches!(self, Self::Indeterminate(_) | Self::Failed(_) | Self::TimedOut)
    }

    pub fn reason(&self) -> String {
        match self {
            Self::Unavailable(reason) | Self::Indeterminate(reason) | Self::Failed(reason) => reason.clone(),
            Self::TimedOut => "Provider observation timed out.".into(),
            Self::Present { .. } | Self::Absent => String::new(),
        }
    }
}

struct ProbeRun {
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

enum RunResult {
    Missing,
    Failed,
    TimedOut,
    Done(ProbeRun),
}

fn probe_budget(ctx: &Context) -> Duration {
    ctx.remaining().map_or(PROBE_BUDGET, |left| left.min(PROBE_BUDGET))
}

fn run(ctx: &Context, argv: &[&str]) -> RunResult {
    let Some((program, args)) = argv.split_first() else {
        return RunResult::Failed;
    };
    let Some(path) = process::which(program) else {
        return RunResult::Missing;
    };
    match process::run_captured(&path, args, Some(probe_budget(ctx))) {
        Ok(output) if output.timed_out => {
            if ctx.deadline_passed() {
                ctx.mark_deadline_hit();
            }
            RunResult::TimedOut
        }
        Ok(output) => RunResult::Done(ProbeRun {
            code: output.code,
            stdout: output.stdout,
            stderr: output.stderr,
        }),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => RunResult::Missing,
        Err(_) => RunResult::Failed,
    }
}

fn unavailable(provider: Provider) -> Observed {
    Observed::Unavailable(format!("{} executable is unavailable", provider.as_str()))
}

fn unknown(provider: Provider, target: &ProviderTarget) -> Observed {
    Observed::Indeterminate(format!(
        "{} could not determine whether {} is installed",
        provider.as_str(),
        target.id
    ))
}

fn present(version: Option<String>) -> Observed {
    Observed::Present {
        version: version.filter(|version| !version.is_empty()),
    }
}

/// Probes whether `binding`'s target is installed, as v1's observation registry did.
pub fn observe(ctx: &Context, binding: &Binding) -> Observed {
    let provider = binding.provider;
    let target = &binding.target;
    let done = |result: RunResult| -> Result<ProbeRun, Observed> {
        match result {
            RunResult::Missing => Err(unavailable(provider)),
            RunResult::Failed => Err(unknown(provider, target)),
            RunResult::TimedOut => Err(Observed::TimedOut),
            RunResult::Done(run) => Ok(run),
        }
    };
    match provider {
        Provider::Npm => {
            let run = match done(run(ctx, &["npm", "list", "-g", &target.id, "--depth=0", "--json"])) {
                Ok(run) => run,
                Err(observed) => return observed,
            };
            if run.stdout.trim().is_empty() {
                return unknown(provider, target);
            }
            let Ok(Value::Object(data)) = serde_json::from_str::<Value>(&run.stdout) else {
                return unknown(provider, target);
            };
            if data.contains_key("error") {
                return unknown(provider, target);
            }
            match data.get("dependencies").and_then(|deps| deps.get(&target.id)) {
                Some(entry) if !entry.is_null() => present(entry["version"].as_str().map(str::to_owned)),
                _ => Observed::Absent,
            }
        }
        Provider::Bun => {
            let run = match done(run(ctx, &["bun", "pm", "-g", "ls"])) {
                Ok(run) => run,
                Err(observed) => return observed,
            };
            if run.stdout.trim().is_empty() {
                if run.stderr.contains("No package.json was found for directory") {
                    return Observed::Absent;
                }
                if !run.stderr.contains("Lockfile not found") {
                    return unknown(provider, target);
                }
                return bun_manifest_presence(&target.id).unwrap_or_else(|| unknown(provider, target));
            }
            let marker = format!("{}@", target.id);
            for line in run.stdout.lines() {
                if let Some(token) = line.split_whitespace().last()
                    && let Some(version) = token.strip_prefix(&marker)
                    && !version.is_empty()
                {
                    return present(Some(version.to_owned()));
                }
            }
            if run.stdout.lines().any(|line| {
                line.split_whitespace()
                    .last()
                    .is_some_and(|token| token.starts_with(&marker))
            }) {
                return present(None);
            }
            bun_manifest_presence(&target.id).unwrap_or(Observed::Absent)
        }
        Provider::Brew => {
            let kind = if target.kind == "cask" { "--cask" } else { "--formula" };
            let run = match done(run(ctx, &["brew", "list", kind, "--versions", &target.id])) {
                Ok(run) => run,
                Err(observed) => return observed,
            };
            if run.code == Some(0) {
                let version = run
                    .stdout
                    .split_whitespace()
                    .last()
                    .filter(|version| version.starts_with(|c: char| c.is_ascii_digit()))
                    .map(str::to_owned);
                return present(version);
            }
            let missing = run.stderr.to_lowercase();
            if missing.contains("no such keg") || missing.contains("is not installed") {
                Observed::Absent
            } else {
                unknown(provider, target)
            }
        }
        Provider::Winget => {
            let run = match done(run(ctx, &["winget", "list", "--id", &target.id, "-e"])) {
                Ok(run) => run,
                Err(observed) => return observed,
            };
            let id = target.id.to_lowercase();
            if run.code == Some(0) {
                for line in run.stdout.lines() {
                    let parts: Vec<&str> = line
                        .trim()
                        .split("  ")
                        .flat_map(|part| part.split('\t'))
                        .map(str::trim)
                        .filter(|part| !part.is_empty())
                        .collect();
                    if let Some(index) = parts.iter().position(|part| part.to_lowercase() == id) {
                        return present(parts.get(index + 1).map(|version| (*version).to_owned()));
                    }
                }
                return if run.stdout.to_lowercase().contains(&id) {
                    present(None)
                } else {
                    unknown(provider, target)
                };
            }
            let output = format!("{}\n{}", run.stdout, run.stderr).to_lowercase();
            if [
                "no installed package found",
                "no package found matching input criteria",
                "no installed package matched",
            ]
            .iter()
            .any(|marker| output.contains(marker))
            {
                Observed::Absent
            } else {
                unknown(provider, target)
            }
        }
        Provider::Script | Provider::Binary => {
            let Some(binary) = &target.binary_name else {
                return Observed::Indeterminate(format!(
                    "{} candidate does not declare an executable presence probe",
                    provider.as_str()
                ));
            };
            if crate::probe::resolve_executable(std::slice::from_ref(binary)).is_some() {
                present(None)
            } else {
                Observed::Absent
            }
        }
    }
}

fn bun_manifest_presence(package: &str) -> Option<Observed> {
    let root = std::env::var("BUN_INSTALL_GLOBAL_DIR")
        .ok()
        .map(PathBuf::from)
        .unwrap_or_else(|| crate::context::home_dir().join(".bun").join("install").join("global"));
    let text = std::fs::read_to_string(root.join("package.json")).ok()?;
    let Value::Object(manifest) = serde_json::from_str::<Value>(&text).ok()? else {
        return Some(Observed::Indeterminate(format!(
            "bun could not determine whether {package} is installed"
        )));
    };
    for field in [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
        "peerDependencies",
    ] {
        if let Some(entries) = manifest.get(field) {
            let Value::Object(entries) = entries else {
                return Some(Observed::Indeterminate(format!(
                    "bun could not determine whether {package} is installed"
                )));
            };
            if entries.contains_key(package) {
                return Some(present(None));
            }
        }
    }
    Some(Observed::Absent)
}

/// Whether a provider can run here (`<tool> --version` exits 0; script and binary
/// installers only need a shell).
pub fn available(provider: Provider) -> bool {
    crate::probe::installer_available(provider)
}

fn owned(parts: &[&str]) -> Vec<String> {
    parts.iter().map(|part| (*part).to_owned()).collect()
}

/// The command that installs `binding`.
pub fn install_command(binding: &Binding, agent: &Agent) -> Vec<String> {
    let target = &binding.target;
    let mut argv = match binding.provider {
        Provider::Npm => owned(&["npm", "install", "-g", &target.id]),
        Provider::Bun => owned(&["bun", "add", "-g", &target.id]),
        Provider::Brew => {
            let mut argv = owned(&["brew", "install"]);
            if target.kind == "cask" {
                argv.push("--cask".into());
            }
            argv.push(target.id.clone());
            argv
        }
        Provider::Winget => owned(&["winget", "install", "--id", &target.id, "-e"]),
        Provider::Script | Provider::Binary => return effect_command(binding, agent),
    };
    argv.shrink_to_fit();
    argv
}

/// A script or binary candidate's effect as an argv.
fn effect_command(binding: &Binding, agent: &Agent) -> Vec<String> {
    let candidate = agent.candidates().iter().find(|candidate| {
        candidate.provider == binding.provider && candidate.command().as_deref() == Some(&binding.target.id)
    });
    match candidate.and_then(|candidate| candidate.target.effect.clone()) {
        Some(crate::catalog::Effect::Executable { command }) => command,
        Some(crate::catalog::Effect::ShellScript { command }) => shell(&command),
        None => shell(&binding.target.id),
    }
}

fn shell(command: &str) -> Vec<String> {
    if cfg!(windows) {
        owned(&["powershell.exe", "-Command", command])
    } else {
        owned(&["sh", "-c", command])
    }
}

/// The command that updates `binding` in place, to the latest release.
pub fn update_command(binding: &Binding) -> Option<Vec<String>> {
    let target = &binding.target;
    Some(match binding.provider {
        Provider::Npm => owned(&["npm", "install", "-g", &format!("{}@latest", target.id)]),
        Provider::Bun => owned(&["bun", "update", "-g", "--latest", &target.id]),
        Provider::Brew => {
            let mut argv = owned(&["brew", "upgrade"]);
            if target.kind == "cask" {
                argv.push("--cask".into());
            }
            argv.push(target.id.clone());
            argv
        }
        Provider::Winget => owned(&["winget", "upgrade", "--id", &target.id, "-e"]),
        Provider::Script | Provider::Binary => return None,
    })
}

/// The command that removes `binding`.
pub fn uninstall_command(binding: &Binding) -> Option<Vec<String>> {
    let target = &binding.target;
    Some(match binding.provider {
        Provider::Npm => owned(&["npm", "uninstall", "-g", &target.id]),
        Provider::Bun => owned(&["bun", "remove", "-g", &target.id]),
        Provider::Brew => {
            let mut argv = owned(&["brew", "uninstall"]);
            if target.kind == "cask" {
                argv.push("--cask".into());
            }
            argv.push(target.id.clone());
            argv
        }
        Provider::Winget => owned(&["winget", "uninstall", "--id", &target.id, "-e"]),
        Provider::Script | Provider::Binary => return None,
    })
}

/// Why a provider command did not succeed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MutationFailure {
    Failed(String),
    TimedOut,
    Cancelled,
}

impl MutationFailure {
    pub fn reason(&self) -> String {
        match self {
            Self::Failed(reason) => reason.clone(),
            Self::TimedOut => "Provider command timed out.".into(),
            Self::Cancelled => "Provider command was cancelled.".into(),
        }
    }
}

/// Runs a provider mutation. Its output goes to the terminal in human mode and to
/// stderr in structured modes, so stdout stays protocol-only.
pub fn run_mutation(ctx: &Context, argv: &[String], description: &str) -> Result<(), MutationFailure> {
    let Some((program, args)) = argv.split_first() else {
        return Err(MutationFailure::Failed(format!("{description}: empty command")));
    };
    let Some(path) = process::which(program).or_else(|| {
        let candidate = std::path::Path::new(program);
        candidate.is_absolute().then(|| candidate.to_path_buf())
    }) else {
        return Err(MutationFailure::Failed(format!(
            "{description}: {program} was not found"
        )));
    };
    let mut command: Command = process::command_for(&path);
    command.args(args).stdin(Stdio::null());
    if ctx.output_mode.is_structured() {
        command.stdout(std::io::stderr());
        command.stderr(Stdio::inherit());
    } else {
        command.stdout(Stdio::inherit()).stderr(Stdio::inherit());
    }
    let mut child = command
        .spawn()
        .map_err(|error| MutationFailure::Failed(format!("{description}: {error}")))?;
    let deadline = ctx.deadline();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return match status.code() {
                    Some(0) => Ok(()),
                    Some(code) => Err(MutationFailure::Failed(format!("{description} with exit code {code}"))),
                    None => Err(MutationFailure::Failed(format!(
                        "{description}: terminated by a signal"
                    ))),
                };
            }
            Ok(None) => {}
            Err(error) => return Err(MutationFailure::Failed(format!("{description}: {error}"))),
        }
        if ctx.is_cancelled() {
            let _ = child.kill();
            let _ = child.wait();
            return Err(MutationFailure::Cancelled);
        }
        if deadline.is_some_and(|deadline| std::time::Instant::now() >= deadline) {
            let _ = child.kill();
            let _ = child.wait();
            ctx.mark_deadline_hit();
            return Err(MutationFailure::TimedOut);
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}

/// After `bun add -g`, trust packages whose lifecycle scripts Bun blocked.
pub fn trust_bun_packages(ctx: &Context, packages: &[String]) -> Result<(), MutationFailure> {
    let Some(bun) = process::which("bun") else {
        return Ok(());
    };
    let Ok(output) = process::run_captured(&bun, ["pm", "-g", "untrusted"], Some(probe_budget(ctx))) else {
        return Err(MutationFailure::Failed("bun trust inspection failed".into()));
    };
    if output.code != Some(0) {
        return Err(MutationFailure::Failed(format!(
            "bun trust inspection failed with exit code {}",
            output.code.unwrap_or(-1)
        )));
    }
    let untrusted: Vec<String> = output
        .stdout
        .lines()
        .filter_map(|line| {
            let line = line.replace('\\', "/");
            let rest = line.strip_prefix("./node_modules/")?;
            Some(rest.split(" @").next()?.to_owned())
        })
        .collect();
    let blocked: Vec<String> = packages
        .iter()
        .filter(|package| untrusted.contains(package))
        .cloned()
        .collect();
    if blocked.is_empty() {
        return Ok(());
    }
    let mut argv = owned(&["bun", "pm", "-g", "trust"]);
    argv.extend(blocked);
    run_mutation(ctx, &argv, "bun trust failed")
}

/// v1 `getAdoptableExistingInstallMethod`: the catalog method an untracked executable
/// can be attributed to, from its path or from a single installer-only method.
pub fn adoptable_method(methods: &[InstallMethod], binary_path: Option<&std::path::Path>) -> Option<InstallMethod> {
    if let Some(path) = binary_path {
        let normalized = path.to_string_lossy().replace('\\', "/");
        let inferred = if normalized.contains("/.bun/bin/") || normalized.contains("/.bun/install/global/") {
            Some(Provider::Bun)
        } else if !normalized.contains("/node_modules/.bin/")
            && [
                "/lib/node_modules/",
                "/AppData/Roaming/npm/",
                "/.nvm/versions/node/",
                "/.fnm/node-versions/",
                "/.volta/tools/image/node/",
            ]
            .iter()
            .any(|segment| normalized.contains(segment))
        {
            Some(Provider::Npm)
        } else {
            None
        };
        if let Some(kind) = inferred
            && let Some(method) = methods.iter().find(|method| method.kind == kind)
        {
            return Some(method.clone());
        }
    }
    match methods {
        [only] if !only.kind.is_managed() => Some(only.clone()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn script_bindings_target_the_install_command() {
        let claude = crate::catalog::find("claude").unwrap();
        let bindings = catalog_bindings(claude);
        let script = bindings
            .iter()
            .find(|binding| binding.provider == Provider::Script)
            .unwrap();
        assert_eq!(script.target.kind, "script");
        assert_eq!(script.target.binary_name.as_deref(), Some("claude"));
        assert!(script.target.id.contains("install"));
        let npm = bindings
            .iter()
            .find(|binding| binding.provider == Provider::Npm)
            .unwrap();
        assert_eq!(npm.target.id, "@anthropic-ai/claude-code");
        assert_eq!(npm.target.kind, "package");
    }

    #[test]
    fn adoption_follows_the_executable_path() {
        let claude = crate::catalog::find("claude").unwrap();
        let methods = claude.install_methods();
        let path = std::path::Path::new("/Users/a/.bun/install/global/node_modules/@anthropic-ai/claude-code/cli.js");
        assert_eq!(adoptable_method(&methods, Some(path)).unwrap().kind, Provider::Bun);
        assert!(adoptable_method(&methods, Some(std::path::Path::new("/usr/local/bin/claude"))).is_none());
    }
}
