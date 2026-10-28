//! Quantex: an agent lifecycle CLI for humans and agents.

// Commands return a finished `Outcome` as their error value; it is not a hot path.
#![allow(clippy::result_large_err)]

use std::ffi::OsString;
use std::io::Write;
use std::sync::Arc;

pub mod catalog;
pub mod cli;
pub mod commands;
pub mod context;
pub mod contract;
pub mod launch;
pub mod lifecycle;
pub mod net;
pub mod observe;
pub mod probe;
pub mod process;
pub mod protocol;
pub mod runtime;
pub mod selfupdate;
pub mod store;
pub mod term;
pub mod time;

use cli::Parsed;
use context::{Context, GlobalArgs};
use protocol::{CommandError, Outcome};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Runs the CLI with the given argv (including the program name) and returns the exit code.
pub fn run(args: Vec<OsString>) -> i32 {
    let argv: Vec<String> = args
        .iter()
        .skip(1)
        .map(|arg| arg.to_string_lossy().into_owned())
        .collect();
    match cli::parse(&argv) {
        Parsed::Version => {
            println!("{VERSION}");
            0
        }
        Parsed::Help { text, to_stderr, code } => {
            if to_stderr {
                let _ = std::io::stderr().write_all(text.as_bytes());
            } else {
                let _ = std::io::stdout().write_all(text.as_bytes());
            }
            code
        }
        Parsed::Error { action, globals, error } => report_error(&action, &globals, error),
        Parsed::Command(invocation) => match Context::resolve(&invocation.globals) {
            Ok(ctx) => {
                runtime::install_signal_handlers();
                commands::dispatch(Arc::new(ctx), invocation)
            }
            Err(error) => report_error(invocation.name, &invocation.globals, error),
        },
        Parsed::Shortcut { agent, args, globals } => match Context::resolve(&globals) {
            Ok(ctx) => {
                runtime::install_signal_handlers();
                launch::run(&ctx, &agent, &args, launch::InstallPolicy::Prompt)
            }
            Err(error) => report_error("exec", &globals, error),
        },
        Parsed::Exec {
            agent,
            args,
            install,
            globals,
        } => {
            let Some(policy) = launch::InstallPolicy::parse(&install) else {
                let error = CommandError::new(
                    protocol::ErrorCode::InvalidArgument,
                    format!("Unknown install policy: {install}"),
                )
                .details(serde_json::json!({ "option": "--install", "value": install }));
                return report_error("exec", &globals, error);
            };
            match Context::resolve(&globals) {
                Ok(ctx) => {
                    runtime::install_signal_handlers();
                    launch::run(&ctx, &agent, &args, policy)
                }
                Err(error) => report_error("exec", &globals, error),
            }
        }
    }
}

/// Reports an error that happened before a command could run.
fn report_error(action: &str, globals: &GlobalArgs, error: CommandError) -> i32 {
    let ctx = Context::resolve(globals).unwrap_or_else(|_| Context::lenient(globals));
    let outcome = Outcome::failure(action, None, error);
    protocol::emit(&ctx, &outcome);
    outcome.process_exit_code()
}
