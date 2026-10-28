//! One module per command; `dispatch` routes a parsed invocation to it.

use std::sync::Arc;

use crate::cli::Invocation;
use crate::context::Context;
use crate::protocol::{CommandError, ErrorCode, Outcome, Target};
use crate::runtime;

mod agents;
mod catalog_commands;
mod config;
pub mod mutate;
mod system;
mod update;

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
        "install" => {
            let agents = invocation.args("agents").to_vec();
            let targets = mutate::normalize_targets(&agents);
            let target = match targets.as_slice() {
                [only] => Target::agent(only),
                many => Target::agent(&many.join(",")),
            };
            runtime::execute(ctx, "install", Some(target), move |ctx| mutate::install(ctx, &agents))
        }
        "uninstall" => {
            let agent = invocation.arg("agent").unwrap_or_default().to_owned();
            runtime::execute(ctx, "uninstall", Some(Target::agent(&agent)), move |ctx| {
                mutate::uninstall(ctx, &agent)
            })
        }
        "ensure" => {
            let agent = invocation.arg("agent").unwrap_or_default().to_owned();
            runtime::execute(ctx, "ensure", Some(Target::agent(&agent)), move |ctx| {
                mutate::ensure(ctx, &agent)
            })
        }
        "update" => {
            let agent = invocation.arg("agent").map(str::to_owned);
            let all = invocation.flag("all");
            let managed = invocation.flag("managed");
            let target = match (&agent, all) {
                (Some(agent), false) => Target::agent(agent),
                _ => Target::new(crate::protocol::TargetKind::Agent, None::<String>),
            };
            runtime::execute(ctx, "update", Some(target), move |ctx| {
                update::update(ctx, agent.as_deref(), all, managed)
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
