//! One module per command; `dispatch` routes a parsed invocation to it.

use std::sync::Arc;

use crate::cli::Invocation;
use crate::context::Context;
use crate::protocol::{CommandError, ErrorCode, Outcome, Target};
use crate::runtime;

mod agents;
mod catalog_commands;
mod config;
mod system;

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
        "list" => runtime::execute(ctx, "list", Some(Target::system("agents")), agents::list),
        "info" | "inspect" | "resolve" => {
            let name = invocation.name;
            let agent = invocation.arg("agent").unwrap_or_default().to_owned();
            let target = Target::agent(&agent);
            runtime::execute(ctx, name, Some(target), move |ctx| match name {
                "info" => agents::info(ctx, &agent),
                "inspect" => agents::inspect(ctx, &agent),
                _ => agents::resolve(ctx, &agent),
            })
        }
        "capabilities" => runtime::execute(
            ctx,
            "capabilities",
            Some(Target::system("capabilities")),
            system::capabilities,
        ),
        "doctor" => runtime::execute(ctx, "doctor", Some(Target::system("doctor")), system::doctor),
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
