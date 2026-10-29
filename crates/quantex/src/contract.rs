//! Interface data embedded from the repository `contract/` directory.

use std::sync::OnceLock;

use serde::Deserialize;
use serde_json::Value;

const REGISTRY_JSON: &str = include_str!("../../../contract/cli/registry.json");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Registry {
    pub program: Program,
    pub global_options: Vec<GlobalOptionSpec>,
    pub commands: Vec<CommandSpec>,
}

#[derive(Debug, Deserialize)]
pub struct Program {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ValueKind {
    Boolean,
    String,
}

#[derive(Debug, Deserialize)]
pub struct GlobalOptionSpec {
    pub id: String,
    pub flags: String,
    pub description: String,
    pub value: ValueKind,
}

impl GlobalOptionSpec {
    pub fn long(&self) -> &str {
        long_flag(&self.flags)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandSpec {
    pub name: String,
    pub aliases: Vec<String>,
    pub summary: String,
    pub description: String,
    pub arguments: Vec<ArgumentSpec>,
    pub options: Vec<OptionSpec>,
    pub catalog_tokens: Vec<String>,
    pub allow_unknown_options: bool,
    pub effects: Vec<String>,
    pub global_options: Vec<String>,
    pub flags: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ArgumentSpec {
    pub name: String,
    pub description: String,
    pub syntax: String,
}

impl ArgumentSpec {
    pub fn required(&self) -> bool {
        self.syntax.starts_with('<')
    }

    pub fn variadic(&self) -> bool {
        self.syntax.contains("...")
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionSpec {
    pub id: String,
    pub flags: String,
    pub description: String,
    pub value: ValueKind,
    #[serde(default)]
    pub default_value: Option<Value>,
}

impl OptionSpec {
    pub fn long(&self) -> &str {
        long_flag(&self.flags)
    }
}

/// Returns the long option name without dashes, e.g. `--timeout <duration>` → `timeout`.
fn long_flag(flags: &str) -> &str {
    let start = flags.find("--").map(|index| index + 2).unwrap_or(0);
    let rest = &flags[start..];
    let end = rest
        .find(|c: char| !(c.is_ascii_alphanumeric() || c == '-'))
        .unwrap_or(rest.len());
    &rest[..end]
}

pub fn registry() -> &'static Registry {
    static REGISTRY: OnceLock<Registry> = OnceLock::new();
    REGISTRY.get_or_init(|| serde_json::from_str(REGISTRY_JSON).expect("contract/cli/registry.json is valid"))
}

pub fn command(name: &str) -> Option<&'static CommandSpec> {
    registry().commands.iter().find(|command| command.name == name)
}

/// Resolves a command name or alias to its canonical command.
pub fn resolve_command(token: &str) -> Option<&'static CommandSpec> {
    registry()
        .commands
        .iter()
        .find(|command| command.name == token || command.aliases.iter().any(|alias| alias == token))
}

pub fn global_option_by_long(long: &str) -> Option<&'static GlobalOptionSpec> {
    registry().global_options.iter().find(|option| option.long() == long)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn long_flags_are_extracted() {
        assert_eq!(long_flag("--timeout <duration>"), "timeout");
        assert_eq!(long_flag("--non-interactive"), "non-interactive");
    }

    #[test]
    fn discovery_flags_are_catalog_tokens_then_options_then_globals() {
        for command in &registry().commands {
            let mut expected: Vec<String> = command.catalog_tokens.clone();
            expected.extend(command.options.iter().map(|option| format!("--{}", option.long())));
            for id in &command.global_options {
                let option = registry()
                    .global_options
                    .iter()
                    .find(|option| &option.id == id)
                    .unwrap();
                expected.push(format!("--{}", option.long()));
            }
            assert_eq!(expected, command.flags, "{}", command.name);
        }
    }
}
