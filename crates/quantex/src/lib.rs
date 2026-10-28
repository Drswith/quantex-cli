//! Quantex: an agent lifecycle CLI for humans and agents.

use std::ffi::OsString;
use std::io::Write;
use std::sync::Arc;

pub mod catalog;
pub mod cli;
pub mod commands;
pub mod context;
pub mod contract;
pub mod process;
pub mod protocol;
pub mod runtime;
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
        Parsed::Shortcut { globals, .. } | Parsed::Exec { globals, .. } => report_error(
            "exec",
            &globals,
            CommandError::new(
                protocol::ErrorCode::InvalidArgument,
                "Agent launch is not implemented in this build yet",
            ),
        ),
    }
}

/// Reports an error that happened before a command could run.
fn report_error(action: &str, globals: &GlobalArgs, error: CommandError) -> i32 {
    let ctx = Context::resolve(globals).unwrap_or_else(|_| Context::lenient(globals));
    let outcome = Outcome::failure(action, None, error);
    protocol::emit(&ctx, &outcome);
    outcome.process_exit_code()
}
