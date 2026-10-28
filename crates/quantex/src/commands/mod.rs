//! One module per command; `dispatch` routes a parsed invocation to it.

use std::sync::Arc;

use crate::cli::Invocation;
use crate::context::Context;
use crate::protocol::{CommandError, ErrorCode, Outcome, Target};
use crate::runtime;

mod catalog_commands;
mod config;

/// Runs a management command and returns the process exit code.
pub fn dispatch(ctx: Arc<Context>, invocation: Invocation) -> i32 {
    match invocation.name {
        "commands" => runtime::execute(ctx, "commands", Some(Target::system("commands")), |_| {
            catalog_commands::commands()
        }),
        "schema" => {
            let command = invocation.arg("command").map(str::to_owned);
            runtime::execute(ctx, "schema", Some(Target::system("schema")), move |_| {
                catalog_commands::schema(command.as_deref())
            })
        }
        "config" => {
            let action = invocation.arg("action").map(str::to_owned);
            let key = invocation.arg("key").map(str::to_owned);
            let value = invocation.arg("value").map(str::to_owned);
            let target = Target::new(crate::protocol::TargetKind::Config, key.as_deref());
            runtime::execute(ctx, "config", Some(target), move |ctx| {
                config::run(ctx, action.as_deref(), key.as_deref(), value.as_deref())
            })
        }
        other => {
            let outcome = Outcome::failure(
                other,
                None,
                CommandError::new(
                    ErrorCode::InvalidArgument,
                    format!("{other} is not implemented in this build yet"),
                ),
            );
            crate::protocol::emit(&ctx, &outcome);
            1
        }
    }
}

/// Work that runs after a result has been written, such as the update notice.
pub fn after_success(_ctx: &Context, _outcome: &Outcome) {}
