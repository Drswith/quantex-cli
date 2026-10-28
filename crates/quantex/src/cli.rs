//! argv parsing: the bare-agent shortcut, `exec` pass-through, and clap for the rest.

use std::collections::{BTreeMap, BTreeSet};

use clap::error::{ContextKind, ContextValue, ErrorKind};
use clap::{Arg, ArgAction, Command};
use serde_json::json;

use crate::context::GlobalArgs;
use crate::contract::{self, ValueKind};
use crate::protocol::{CommandError, ErrorCode};

/// A parsed command-line.
#[derive(Debug)]
pub enum Parsed {
    Version,
    Help {
        text: String,
        to_stderr: bool,
        code: i32,
    },
    /// `quantex <agent> [args...]`.
    Shortcut {
        agent: String,
        args: Vec<String>,
        globals: GlobalArgs,
    },
    /// `quantex exec <agent> [args...]`.
    Exec {
        agent: String,
        args: Vec<String>,
        install: String,
        globals: GlobalArgs,
    },
    Command(Invocation),
    Error {
        action: String,
        globals: GlobalArgs,
        error: CommandError,
    },
}

/// A management command with its arguments.
#[derive(Debug)]
pub struct Invocation {
    pub name: &'static str,
    pub globals: GlobalArgs,
    args: BTreeMap<String, Vec<String>>,
    flags: BTreeSet<String>,
    values: BTreeMap<String, String>,
}

impl Invocation {
    pub fn arg(&self, name: &str) -> Option<&str> {
        self.args
            .get(name)
            .and_then(|values| values.first())
            .map(String::as_str)
    }

    pub fn args(&self, name: &str) -> &[String] {
        self.args.get(name).map_or(&[], Vec::as_slice)
    }

    pub fn flag(&self, id: &str) -> bool {
        self.flags.contains(id)
    }

    pub fn value(&self, id: &str) -> Option<&str> {
        self.values.get(id).map(String::as_str)
    }
}

const SHORTCUT_STRUCTURED_ERROR: &str =
    "Structured output is not supported for shortcut agent execution yet. Use a management command instead.";

pub fn parse(argv: &[String]) -> Parsed {
    let prescan = prescan_globals(argv);
    if argv.is_empty() {
        return Parsed::Help {
            text: build_clap().render_help().to_string(),
            to_stderr: true,
            code: 1,
        };
    }
    if let Some(parsed) = parse_shortcut(argv) {
        return parsed;
    }
    if let Some(index) = first_operand(argv)
        && contract::resolve_command(&argv[index]).is_some_and(|command| command.name == "exec")
    {
        return parse_exec(argv, index, prescan);
    }
    parse_with_clap(argv, prescan)
}

/// Global options found anywhere before `--`, used to pick the error output mode.
fn prescan_globals(argv: &[String]) -> GlobalArgs {
    let mut globals = GlobalArgs::default();
    let mut index = 0;
    while index < argv.len() {
        let token = &argv[index];
        if token == "--" {
            break;
        }
        if let Some(long) = token.strip_prefix("--") {
            let (name, inline) = match long.split_once('=') {
                Some((name, value)) => (name, Some(value.to_owned())),
                None => (long, None),
            };
            if let Some(option) = contract::global_option_by_long(name) {
                if option.value == ValueKind::String {
                    let value = inline.or_else(|| {
                        index += 1;
                        argv.get(index).cloned()
                    });
                    if let Some(value) = value {
                        set_global_value(&mut globals, &option.id, value);
                    }
                } else {
                    set_global_flag(&mut globals, &option.id);
                }
            }
        }
        index += 1;
    }
    globals
}

fn set_global_flag(globals: &mut GlobalArgs, id: &str) {
    match id {
        "json" => globals.json = true,
        "nonInteractive" => globals.non_interactive = true,
        "yes" => globals.yes = true,
        "quiet" => globals.quiet = true,
        "dryRun" => globals.dry_run = true,
        "refresh" => globals.refresh = true,
        "noCache" => globals.no_cache = true,
        _ => {}
    }
}

fn set_global_value(globals: &mut GlobalArgs, id: &str, value: String) {
    match id {
        "output" => globals.output = Some(value),
        "color" => globals.color = Some(value),
        "logLevel" => globals.log_level = Some(value),
        "runId" => globals.run_id = Some(value),
        "idempotencyKey" => globals.idempotency_key = Some(value),
        "timeout" => globals.timeout = Some(value),
        _ => {}
    }
}

/// Index of the first token that is not a global option or its value.
fn first_operand(argv: &[String]) -> Option<usize> {
    let mut index = 0;
    while index < argv.len() {
        let token = &argv[index];
        if token == "--" {
            return None;
        }
        if let Some(long) = token.strip_prefix("--") {
            let (name, inline) = long.split_once('=').map_or((long, false), |(name, _)| (name, true));
            if let Some(option) = contract::global_option_by_long(name) {
                index += if option.value == ValueKind::String && !inline {
                    2
                } else {
                    1
                };
                continue;
            }
            return None;
        }
        if token.starts_with('-') {
            return None;
        }
        return Some(index);
    }
    None
}

fn is_known_command_token(token: &str) -> bool {
    token == "help" || contract::resolve_command(token).is_some()
}

/// `quantex [global options] <agent> [agent args...]`, where `<agent>` is not a command.
fn parse_shortcut(argv: &[String]) -> Option<Parsed> {
    let mut globals = GlobalArgs::default();
    let mut index = 0;
    while index < argv.len() {
        let token = &argv[index];
        if let Some(option) = token.strip_prefix("--").and_then(contract::global_option_by_long) {
            if option.value == ValueKind::String {
                match argv.get(index + 1).filter(|value| !value.is_empty()) {
                    Some(value) => set_global_value(&mut globals, &option.id, value.clone()),
                    None => {
                        let error = CommandError::new(ErrorCode::InvalidArgument, format!("{token} requires a value"))
                            .details(json!({ "option": token }));
                        return Some(Parsed::Error {
                            action: "quantex".into(),
                            globals,
                            error,
                        });
                    }
                }
                index += 2;
            } else {
                set_global_flag(&mut globals, &option.id);
                index += 1;
            }
            continue;
        }
        if token.starts_with('-') || is_known_command_token(token) {
            return None;
        }
        crate::catalog::find(token)?;
        if globals.output_mode().is_structured() {
            let error = CommandError::new(ErrorCode::InvalidArgument, SHORTCUT_STRUCTURED_ERROR)
                .details(json!({ "agent": token }));
            return Some(Parsed::Error {
                action: "quantex".into(),
                globals,
                error,
            });
        }
        return Some(Parsed::Shortcut {
            agent: token.clone(),
            args: argv[index + 1..].to_vec(),
            globals,
        });
    }
    None
}

/// `exec` keeps unknown options for the agent, as v1 did: known Quantex options are
/// consumed wherever they appear before `--`, everything else is passed through.
fn parse_exec(argv: &[String], exec_index: usize, prescan: GlobalArgs) -> Parsed {
    let mut globals = GlobalArgs::default();
    let mut install = "never".to_owned();
    let mut agent: Option<String> = None;
    let mut passthrough = Vec::new();
    let mut index = 0;
    let error = |message: String, globals: GlobalArgs| Parsed::Error {
        action: "exec".into(),
        globals,
        error: CommandError::new(ErrorCode::InvalidArgument, message),
    };
    while index < argv.len() {
        let token = &argv[index];
        if index == exec_index {
            index += 1;
            continue;
        }
        if token == "--" {
            passthrough.extend(argv[index + 1..].iter().cloned());
            break;
        }
        if token == "--help" || token == "-h" {
            let help = build_clap()
                .find_subcommand_mut("exec")
                .map(|command| command.render_help().to_string())
                .unwrap_or_default();
            return Parsed::Help {
                text: help,
                to_stderr: false,
                code: 0,
            };
        }
        if let Some(long) = token.strip_prefix("--") {
            let (name, inline) = match long.split_once('=') {
                Some((name, value)) => (name, Some(value.to_owned())),
                None => (long, None),
            };
            let is_install = name == "install";
            let global = contract::global_option_by_long(name);
            if is_install || global.is_some() {
                let takes_value = is_install || global.is_some_and(|option| option.value == ValueKind::String);
                if takes_value {
                    let value = match inline {
                        Some(value) => value,
                        None => {
                            index += 1;
                            match argv.get(index) {
                                Some(value) => value.clone(),
                                None => {
                                    return error(format!("Option '--{name}' requires a value"), prescan);
                                }
                            }
                        }
                    };
                    if is_install {
                        install = value;
                    } else {
                        set_global_value(&mut globals, &global.unwrap().id, value);
                    }
                } else {
                    set_global_flag(&mut globals, &global.unwrap().id);
                }
                index += 1;
                continue;
            }
        }
        if agent.is_none() && !token.starts_with('-') {
            agent = Some(token.clone());
        } else {
            passthrough.push(token.clone());
        }
        index += 1;
    }
    let Some(agent) = agent else {
        return Parsed::Error {
            action: "exec".into(),
            globals,
            error: CommandError::new(ErrorCode::InvalidArgument, "Missing required argument 'agent'")
                .details(json!({ "argument": "agent" })),
        };
    };
    Parsed::Exec {
        agent,
        args: passthrough,
        install,
        globals,
    }
}

fn leak(text: String) -> &'static str {
    Box::leak(text.into_boxed_str())
}

/// The clap command tree, built from `contract/cli/registry.json`.
pub fn build_clap() -> Command {
    let registry = contract::registry();
    let mut root = Command::new("quantex")
        .about(registry.program.description.as_str())
        .disable_version_flag(true)
        .args_override_self(true)
        .subcommand_required(false)
        .arg(
            Arg::new("version")
                .short('V')
                .long("version")
                .action(ArgAction::SetTrue)
                .help("Print the version"),
        );
    for option in &registry.global_options {
        let long = leak(option.long().to_owned());
        let mut arg = Arg::new(option.id.as_str())
            .long(long)
            .help(option.description.as_str())
            .global(true);
        arg = match option.value {
            ValueKind::Boolean => arg.action(ArgAction::SetTrue),
            ValueKind::String => arg.action(ArgAction::Set).value_name(value_name(&option.flags)),
        };
        root = root.arg(arg);
    }
    for spec in &registry.commands {
        let mut command = Command::new(spec.name.as_str())
            .about(spec.description.as_str())
            .visible_aliases(spec.aliases.iter().map(String::as_str));
        for argument in &spec.arguments {
            let mut arg = Arg::new(argument.name.as_str())
                .help(argument.description.as_str())
                .required(argument.required())
                .value_name(argument.name.as_str());
            if argument.variadic() {
                arg = arg
                    .num_args(if argument.required() { 1.. } else { 0.. })
                    .action(ArgAction::Append);
            }
            command = command.arg(arg);
        }
        for option in &spec.options {
            let long = leak(option.long().to_owned());
            let mut arg = Arg::new(option.id.as_str())
                .long(long)
                .help(option.description.as_str());
            arg = match option.value {
                ValueKind::Boolean => arg.action(ArgAction::SetTrue),
                ValueKind::String => arg.action(ArgAction::Set).value_name(value_name(&option.flags)),
            };
            if let Some(serde_json::Value::String(default)) = &option.default_value {
                arg = arg.default_value(leak(default.clone()));
            }
            command = command.arg(arg);
        }
        root = root.subcommand(command);
    }
    root
}

fn value_name(flags: &str) -> &'static str {
    let start = flags.find('<').map(|index| index + 1);
    let end = flags.find('>');
    match (start, end) {
        (Some(start), Some(end)) if end > start => leak(flags[start..end].to_owned()),
        _ => "value",
    }
}

fn parse_with_clap(argv: &[String], prescan: GlobalArgs) -> Parsed {
    let mut full = vec!["quantex".to_owned()];
    full.extend(argv.iter().cloned());
    let action = first_operand(argv)
        .and_then(|index| contract::resolve_command(&argv[index]))
        .map_or("quantex", |command| command.name.as_str())
        .to_owned();
    let matches = match build_clap().try_get_matches_from(&full) {
        Ok(matches) => matches,
        Err(error) => return clap_error(error, action, prescan),
    };
    if matches.get_flag("version") {
        return Parsed::Version;
    }
    let globals = globals_from(&matches);
    let Some((name, sub)) = matches.subcommand() else {
        return Parsed::Help {
            text: build_clap().render_help().to_string(),
            to_stderr: true,
            code: 1,
        };
    };
    let spec = contract::command(name).expect("clap only yields registry commands");
    let mut invocation = Invocation {
        name: spec.name.as_str(),
        globals,
        args: BTreeMap::new(),
        flags: BTreeSet::new(),
        values: BTreeMap::new(),
    };
    for argument in &spec.arguments {
        if let Some(values) = sub.get_many::<String>(&argument.name) {
            invocation.args.insert(argument.name.clone(), values.cloned().collect());
        }
    }
    for option in &spec.options {
        match option.value {
            ValueKind::Boolean => {
                if sub.get_flag(&option.id) {
                    invocation.flags.insert(option.id.clone());
                }
            }
            ValueKind::String => {
                if let Some(value) = sub.get_one::<String>(&option.id) {
                    invocation.values.insert(option.id.clone(), value.clone());
                }
            }
        }
    }
    Parsed::Command(invocation)
}

fn globals_from(matches: &clap::ArgMatches) -> GlobalArgs {
    let sub = matches.subcommand().map_or(matches, |(_, sub)| sub);
    let flag = |id: &str| sub.get_flag(id) || matches.get_flag(id);
    let value = |id: &str| {
        sub.get_one::<String>(id)
            .or_else(|| matches.get_one::<String>(id))
            .cloned()
    };
    GlobalArgs {
        json: flag("json"),
        output: value("output"),
        non_interactive: flag("nonInteractive"),
        yes: flag("yes"),
        quiet: flag("quiet"),
        color: value("color"),
        log_level: value("logLevel"),
        dry_run: flag("dryRun"),
        refresh: flag("refresh"),
        no_cache: flag("noCache"),
        run_id: value("runId"),
        idempotency_key: value("idempotencyKey"),
        timeout: value("timeout"),
    }
}

fn context_string(error: &clap::Error, kind: ContextKind) -> Option<String> {
    match error.get(kind)? {
        ContextValue::String(value) => Some(value.clone()),
        ContextValue::Strings(values) => Some(values.join(", ")),
        other => Some(other.to_string()),
    }
}

fn clap_error(error: clap::Error, action: String, prescan: GlobalArgs) -> Parsed {
    match error.kind() {
        ErrorKind::DisplayHelp => {
            return Parsed::Help {
                text: error.render().to_string(),
                to_stderr: false,
                code: 0,
            };
        }
        ErrorKind::DisplayHelpOnMissingArgumentOrSubcommand => {
            return Parsed::Help {
                text: error.render().to_string(),
                to_stderr: true,
                code: 1,
            };
        }
        ErrorKind::DisplayVersion => return Parsed::Version,
        _ => {}
    }
    let invalid = context_string(&error, ContextKind::InvalidArg);
    let value = context_string(&error, ContextKind::InvalidValue);
    let (message, details) = match error.kind() {
        ErrorKind::UnknownArgument => {
            let argument = invalid.unwrap_or_default();
            (
                format!("Unknown option '{argument}'"),
                json!({ "reason": "unknown-option", "argument": argument }),
            )
        }
        ErrorKind::InvalidSubcommand => {
            let token = context_string(&error, ContextKind::InvalidSubcommand).unwrap_or_default();
            (
                format!("Unknown command or agent: {token}"),
                json!({ "reason": "unknown-command", "argument": token }),
            )
        }
        ErrorKind::MissingRequiredArgument => {
            let argument = invalid.unwrap_or_default();
            let argument = argument
                .trim_start_matches('<')
                .trim_end_matches('>')
                .trim_end_matches("...");
            (
                format!("Missing required argument '{argument}'"),
                json!({ "reason": "missing-argument", "argument": argument }),
            )
        }
        ErrorKind::InvalidValue | ErrorKind::NoEquals => {
            let argument = invalid.unwrap_or_default();
            if value.as_deref().is_none_or(str::is_empty) {
                (
                    format!("Option '{argument}' requires a value"),
                    json!({ "reason": "missing-value", "argument": argument }),
                )
            } else {
                (
                    format!("Invalid value '{}' for '{argument}'", value.clone().unwrap_or_default()),
                    json!({ "reason": "invalid-value", "argument": argument, "value": value }),
                )
            }
        }
        _ => {
            let rendered = error.render().to_string();
            let first = rendered
                .lines()
                .next()
                .unwrap_or("Invalid arguments")
                .trim_start_matches("error: ")
                .to_owned();
            (first, json!({ "reason": "invalid-arguments" }))
        }
    };
    Parsed::Error {
        action,
        globals: prescan,
        error: CommandError::new(ErrorCode::InvalidArgument, message).details(details),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(text: &str) -> Vec<String> {
        text.split_whitespace().map(str::to_owned).collect()
    }

    #[test]
    fn clap_tree_is_consistent() {
        build_clap().debug_assert();
    }

    #[test]
    fn management_commands_parse_with_globals_anywhere() {
        let Parsed::Command(invocation) = parse(&args("--json info claude --refresh")) else {
            panic!("expected a command");
        };
        assert_eq!(invocation.name, "info");
        assert_eq!(invocation.arg("agent"), Some("claude"));
        assert!(invocation.globals.json && invocation.globals.refresh);
    }

    #[test]
    fn aliases_resolve_to_canonical_commands() {
        let Parsed::Command(invocation) = parse(&args("ls --output json")) else {
            panic!("expected a command");
        };
        assert_eq!(invocation.name, "list");
    }

    #[test]
    fn known_agents_become_shortcuts() {
        let Parsed::Shortcut { agent, args: rest, .. } = parse(&args("--yes claude -p hello")) else {
            panic!("expected a shortcut");
        };
        assert_eq!(agent, "claude");
        assert_eq!(rest, vec!["-p", "hello"]);
    }

    #[test]
    fn structured_shortcuts_are_rejected() {
        assert!(matches!(parse(&args("--json claude")), Parsed::Error { .. }));
    }

    #[test]
    fn exec_passes_unknown_options_through() {
        let Parsed::Exec {
            agent,
            args: rest,
            install,
            globals,
        } = parse(&args("exec claude -p hi --install if-missing --yes -- --yes"))
        else {
            panic!("expected exec");
        };
        assert_eq!(agent, "claude");
        assert_eq!(install, "if-missing");
        assert!(globals.yes);
        assert_eq!(rest, vec!["-p", "hi", "--yes"]);
    }

    #[test]
    fn unknown_options_are_invalid_arguments() {
        let Parsed::Error { action, error, .. } = parse(&args("list --bogus")) else {
            panic!("expected an error");
        };
        assert_eq!(action, "list");
        assert_eq!(error.code, ErrorCode::InvalidArgument);
        assert!(error.message.contains("--bogus"));
    }

    #[test]
    fn missing_arguments_are_invalid_arguments() {
        let Parsed::Error { action, error, .. } = parse(&args("info")) else {
            panic!("expected an error");
        };
        assert_eq!(action, "info");
        assert_eq!(error.message, "Missing required argument 'agent'");
    }

    #[test]
    fn unknown_commands_are_invalid_arguments() {
        let Parsed::Error { action, .. } = parse(&args("definitely-not-a-command")) else {
            panic!("expected an error");
        };
        assert_eq!(action, "quantex");
    }
}
