//! `quantex <agent> [args]` and `quantex exec <agent> [args]`: launch an agent,
//! installing it first when the policy allows.

use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde_json::{Map, Value, json};

use crate::catalog::{self, Agent, Platform};
use crate::context::Context;
use crate::observe::{self, Observation, ObserveOptions};
use crate::protocol::{self, CommandError, ErrorCode, Outcome, Target};
use crate::store;

/// When a missing agent may be installed before launch.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallPolicy {
    Never,
    IfMissing,
    Always,
    /// The bare-agent shortcut: ask, when a terminal is available.
    Prompt,
}

impl InstallPolicy {
    pub fn parse(text: &str) -> Option<Self> {
        Some(match text {
            "never" => Self::Never,
            "if-missing" => Self::IfMissing,
            "always" => Self::Always,
            _ => return None,
        })
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Never => "never",
            Self::IfMissing => "if-missing",
            Self::Always => "always",
            Self::Prompt => "prompt",
        }
    }
}

/// The v1 `AgentDefinition` shape that `exec` reports.
pub fn definition_value(agent: &Agent) -> Value {
    let mut map = Map::new();
    map.insert("binaryName".into(), agent.binary_name.clone().into());
    map.insert("displayName".into(), agent.display_name.clone().into());
    map.insert("homepage".into(), agent.homepage.clone().into());
    if !agent.lookup_aliases.is_empty() {
        map.insert("lookupAliases".into(), json!(agent.lookup_aliases));
    }
    map.insert("name".into(), agent.name.clone().into());
    if !agent.packages.is_empty() {
        map.insert("packages".into(), json!(agent.packages));
    }
    let mut platforms = Map::new();
    for platform in [Platform::Linux, Platform::Macos, Platform::Windows] {
        let candidates = agent.candidates_for(platform);
        if !candidates.is_empty() {
            platforms.insert(
                platform.as_str().into(),
                Value::Array(
                    candidates
                        .iter()
                        .map(|candidate| candidate.install_method().to_value())
                        .collect(),
                ),
            );
        }
    }
    map.insert("platforms".into(), Value::Object(platforms));
    if let Some(update) = &agent.self_update {
        let mut value = Map::new();
        value.insert("command".into(), json!(update.command));
        if !update.fallback_commands.is_empty() {
            value.insert("fallbackCommands".into(), json!(update.fallback_commands));
        }
        if let Some(after) = &update.version_after {
            value.insert("versionAfter".into(), after.clone().into());
        }
        map.insert("selfUpdate".into(), Value::Object(value));
    }
    if let Some(probe) = &agent.version_probe {
        map.insert("versionProbe".into(), json!({ "command": probe.command }));
    }
    Value::Object(map)
}

struct Request<'a> {
    agent_name: &'a str,
    args: &'a [String],
    policy: InstallPolicy,
    interactive: bool,
}

impl Request<'_> {
    fn execution(&self, installed: bool) -> Map<String, Value> {
        let mut map = Map::new();
        map.insert("args".into(), json!(self.args));
        map.insert("installPolicy".into(), self.policy.as_str().into());
        map.insert("installed".into(), installed.into());
        map.insert("interactive".into(), self.interactive.into());
        map.insert("launched".into(), false.into());
        map
    }
}

/// Prints a status line: stdout in human mode, stderr in structured modes so stdout
/// only ever carries protocol output.
fn status_line(ctx: &Context, text: &str) {
    if ctx.output_mode.is_structured() {
        eprintln!("{text}");
    } else {
        println!("{text}");
    }
}

fn error_line(ctx: &Context, text: &str) {
    let human = crate::term::Human::new(ctx);
    let red = human.red(text);
    eprintln!("{red}");
}

fn install_guidance(agent: &Agent, methods: &[catalog::InstallMethod], args: &[String]) -> Value {
    let rows: Vec<Value> = observe::method_rows(agent, methods)
        .into_iter()
        .filter(|row| row["command"].as_str().is_some_and(|command| !command.is_empty()))
        .collect();
    let mut exec_command = vec!["quantex", "exec", agent.name.as_str(), "--install", "if-missing", "--"];
    exec_command.extend(args.iter().map(String::as_str));
    json!({
        "docsRef": "skills/quantex-cli/references/command-recipes.md",
        "installMethods": rows,
        "suggestedAction": "rerun-with-install-policy",
        "suggestedEnsureCommand": format!("quantex ensure {}", agent.name),
        "suggestedExecCommand": exec_command.join(" "),
    })
}

fn emit_structured(ctx: &Context, outcome: Outcome) -> i32 {
    protocol::emit(ctx, &outcome);
    outcome.process_exit_code()
}

fn preflight_error(
    ctx: &Context,
    request: &Request<'_>,
    observation: &Observation,
    code: ErrorCode,
    message: String,
) -> i32 {
    let agent = observation.agent;
    let guidance = install_guidance(agent, &observation.methods, request.args);
    if !ctx.output_mode.is_structured() {
        error_line(ctx, &message);
        let human = crate::term::Human::new(ctx);
        println!(
            "{}",
            human.dim(&format!(
                "Try: {}",
                guidance["suggestedEnsureCommand"].as_str().unwrap_or_default()
            ))
        );
        println!(
            "{}",
            human.dim(&format!(
                "Or:  {}",
                guidance["suggestedExecCommand"].as_str().unwrap_or_default()
            ))
        );
        return code.exit_code();
    }
    let mut execution = request.execution(false);
    execution.insert("installGuidance".into(), guidance.clone());
    emit_structured(
        ctx,
        Outcome::failure(
            "exec",
            Some(Target::agent(&agent.name)),
            CommandError::new(code, message).details(guidance),
        )
        .with_data(json!({ "agent": definition_value(agent), "execution": execution })),
    )
}

/// Asks the user to confirm on the terminal. Empty input means yes.
fn confirm(question: &str) -> bool {
    eprint!("{question} (Y/n) ");
    let _ = std::io::stderr().flush();
    let mut answer = String::new();
    if std::io::stdin().read_line(&mut answer).is_err() {
        return false;
    }
    matches!(answer.trim().to_ascii_lowercase().as_str(), "" | "y" | "yes")
}

/// Launches an agent and returns the process exit code.
pub fn run(ctx: &Context, agent_name: &str, args: &[String], policy: InstallPolicy) -> i32 {
    let request = Request {
        agent_name,
        args,
        policy,
        interactive: ctx.interactive,
    };
    let state = match store::load_state(&ctx.quantex_dir()) {
        Ok(state) => state,
        Err(error) => {
            let error = error.into_command_error();
            if !ctx.output_mode.is_structured() {
                error_line(ctx, &error.message);
                return error.code.exit_code();
            }
            return emit_structured(ctx, Outcome::failure("exec", Some(Target::agent(agent_name)), error));
        }
    };
    let Some(agent) = catalog::find(agent_name) else {
        let message = format!("Unknown agent: {agent_name}");
        if !ctx.output_mode.is_structured() {
            error_line(ctx, &message);
            return ErrorCode::AgentNotFound.exit_code();
        }
        return emit_structured(
            ctx,
            Outcome::failure(
                "exec",
                Some(Target::agent(agent_name)),
                CommandError::new(ErrorCode::AgentNotFound, message),
            )
            .with_data(json!({ "agent": { "name": request.agent_name }, "execution": request.execution(false) })),
        );
    };
    let no_latest = ObserveOptions { latest_version: false };
    let mut observation = observe::observe(ctx, agent, &state, no_latest);
    if ctx.deadline_hit() {
        return timed_out(
            ctx,
            &format!(
                "{} timed out after {}ms.",
                agent.display_name,
                ctx.timeout_ms.unwrap_or_default()
            ),
        );
    }

    if !observation.present {
        match policy {
            InstallPolicy::Never => {
                return preflight_error(
                    ctx,
                    &request,
                    &observation,
                    ErrorCode::AgentNotInstalled,
                    format!("{} is not installed.", agent.display_name),
                );
            }
            InstallPolicy::Prompt if !request.interactive => {
                return preflight_error(
                    ctx,
                    &request,
                    &observation,
                    ErrorCode::InteractionRequired,
                    format!(
                        "{} is not installed and interactive installation is disabled.",
                        agent.display_name
                    ),
                );
            }
            _ => {}
        }
    }

    let argv = |observation: &Observation| -> Vec<String> {
        let program = observation.path_string().unwrap_or_else(|| agent.binary_name.clone());
        std::iter::once(program).chain(args.iter().cloned()).collect()
    };

    if ctx.dry_run {
        if !observation.present {
            status_line(ctx, &format!("Dry run: would install {}.", agent.display_name));
        }
        if !ctx.output_mode.is_structured() {
            println!("Dry run: would run {}", argv(&observation).join(" "));
            return 0;
        }
        return emit_structured(
            ctx,
            Outcome::success(
                "exec",
                Some(Target::agent(&agent.name)),
                json!({ "agent": definition_value(agent), "execution": request.execution(true) }),
            ),
        );
    }

    if !observation.present {
        if policy == InstallPolicy::Prompt
            && !ctx.yes
            && !confirm(&format!(
                "{} is not installed. Would you like to install it?",
                agent.display_name
            ))
        {
            status_line(ctx, "Installation cancelled.");
            return 1;
        }
        if !ctx.quiet || ctx.output_mode.is_structured() {
            status_line(ctx, &format!("Installing {}...", agent.display_name));
        }
        if let Err(failure) = crate::lifecycle::install_for_launch(ctx, agent) {
            return match failure {
                crate::lifecycle::LaunchInstallFailure::TimedOut => {
                    error_line(
                        ctx,
                        &format!(
                            "Installing {} timed out after {}ms.",
                            agent.display_name,
                            ctx.timeout_ms.unwrap_or_default()
                        ),
                    );
                    ErrorCode::Timeout.exit_code()
                }
                crate::lifecycle::LaunchInstallFailure::Failed(_) => {
                    error_line(ctx, &format!("Failed to install {}.", agent.display_name));
                    ErrorCode::InstallFailed.exit_code()
                }
            };
        }
        let state = store::load_state(&ctx.quantex_dir()).unwrap_or_default();
        observation = observe::observe(ctx, agent, &state, no_latest);
        if !observation.present {
            error_line(ctx, &format!("Failed to install {}.", agent.display_name));
            return ErrorCode::InstallFailed.exit_code();
        }
    }

    launch(ctx, agent, &argv(&observation))
}

fn timed_out(ctx: &Context, message: &str) -> i32 {
    error_line(ctx, message);
    ErrorCode::Timeout.exit_code()
}

/// Runs the agent and maps how it ended to an exit code.
fn launch(ctx: &Context, agent: &Agent, argv: &[String]) -> i32 {
    let program = std::path::PathBuf::from(&argv[0]);
    let mut command: Command = crate::process::command_for(&program);
    command.args(&argv[1..]);
    let structured = ctx.output_mode.is_structured();
    if structured {
        // Structured modes reserve stdout for the protocol; the agent's output is drained.
        // With no terminal involved, the agent gets its own process group so a timeout
        // or cancellation can stop everything it started.
        command
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
    } else {
        command
            .stdin(Stdio::inherit())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit());
    }
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            error_line(ctx, &format!("Failed to launch {}: {error}", agent.display_name));
            return 1;
        }
    };
    if structured {
        for stream in [
            child.stdout.take().map(|s| Box::new(s) as Box<dyn Read + Send>),
            child.stderr.take().map(|s| Box::new(s) as Box<dyn Read + Send>),
        ]
        .into_iter()
        .flatten()
        {
            std::thread::spawn(move || {
                let mut stream = stream;
                let _ = std::io::copy(&mut stream, &mut std::io::sink());
            });
        }
    }
    let deadline = ctx.timeout_ms.map(|ms| Instant::now() + Duration::from_millis(ms));
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if let Some(code) = status.code() {
                    return code;
                }
                let reason = termination_signal(&status)
                    .map_or("Agent process exited without an exit code.".to_owned(), |signal| {
                        format!("Agent terminated by {signal}.")
                    });
                error_line(ctx, &format!("Failed to launch {}: {reason}", agent.display_name));
                return 1;
            }
            Ok(None) => {}
            Err(error) => {
                error_line(ctx, &format!("Failed to launch {}: {error}", agent.display_name));
                return 1;
            }
        }
        if let Some(signal) = crate::runtime::take_signal() {
            terminate(&mut child, structured);
            error_line(ctx, &format!("{} was cancelled by {signal}.", agent.display_name));
            return ErrorCode::Cancelled.exit_code();
        }
        if deadline.is_some_and(|deadline| Instant::now() >= deadline) {
            terminate(&mut child, structured);
            error_line(
                ctx,
                &format!(
                    "{} timed out after {}ms.",
                    agent.display_name,
                    ctx.timeout_ms.unwrap_or_default()
                ),
            );
            return ErrorCode::Timeout.exit_code();
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}

#[cfg(unix)]
fn termination_signal(status: &std::process::ExitStatus) -> Option<String> {
    use std::os::unix::process::ExitStatusExt;
    let signal = status.signal()?;
    Some(
        match signal {
            libc::SIGINT => "SIGINT",
            libc::SIGTERM => "SIGTERM",
            libc::SIGKILL => "SIGKILL",
            libc::SIGHUP => "SIGHUP",
            libc::SIGQUIT => "SIGQUIT",
            libc::SIGABRT => "SIGABRT",
            libc::SIGSEGV => "SIGSEGV",
            _ => return Some(format!("signal {signal}")),
        }
        .to_owned(),
    )
}

#[cfg(not(unix))]
fn termination_signal(_status: &std::process::ExitStatus) -> Option<String> {
    None
}

/// Asks the agent to stop, then kills it. `own_group` agents are stopped together
/// with everything they started.
fn terminate(child: &mut std::process::Child, own_group: bool) {
    #[cfg(unix)]
    {
        let pid = child.id() as libc::pid_t;
        // SAFETY: kill(2) / killpg(2) have no memory-safety preconditions.
        unsafe {
            if own_group {
                libc::killpg(pid, libc::SIGTERM);
            } else {
                libc::kill(pid, libc::SIGTERM);
            }
        }
        let started = Instant::now();
        while started.elapsed() < Duration::from_secs(2) {
            if matches!(child.try_wait(), Ok(Some(_))) {
                return;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        if own_group {
            // SAFETY: killpg(2) has no memory-safety preconditions.
            unsafe {
                libc::killpg(pid, libc::SIGKILL);
            }
        }
    }
    #[cfg(windows)]
    if own_group {
        let _ = Command::new("taskkill")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}
