//! The structured output protocol: result envelopes, NDJSON events, error codes.

use std::io::Write;

use serde_json::{Map, Value};

use crate::context::Context;
use crate::term::Human;

pub const SCHEMA_VERSION: &str = "1";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputMode {
    Human,
    Json,
    Ndjson,
}

impl OutputMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Human => "human",
            Self::Json => "json",
            Self::Ndjson => "ndjson",
        }
    }

    pub fn is_structured(self) -> bool {
        self != Self::Human
    }
}

macro_rules! error_codes {
    ($($variant:ident = $name:literal => $exit:literal,)*) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq)]
        pub enum ErrorCode { $($variant,)* }

        impl ErrorCode {
            pub const ALL: &'static [ErrorCode] = &[$(ErrorCode::$variant,)*];

            pub fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $name,)* }
            }

            pub fn exit_code(self) -> i32 {
                match self { $(Self::$variant => $exit,)* }
            }
        }
    };
}

error_codes! {
    AgentNotFound = "AGENT_NOT_FOUND" => 3,
    AgentNotInstalled = "AGENT_NOT_INSTALLED" => 4,
    Cancelled = "CANCELLED" => 11,
    InstallFailed = "INSTALL_FAILED" => 1,
    InteractionRequired = "INTERACTION_REQUIRED" => 7,
    InvalidArgument = "INVALID_ARGUMENT" => 2,
    ManualActionRequired = "MANUAL_ACTION_REQUIRED" => 8,
    NetworkError = "NETWORK_ERROR" => 6,
    ResourceLocked = "RESOURCE_LOCKED" => 9,
    StateReadError = "STATE_READ_ERROR" => 12,
    Timeout = "TIMEOUT" => 10,
    UninstallFailed = "UNINSTALL_FAILED" => 1,
    UninstallUnmanaged = "UNINSTALL_UNMANAGED" => 1,
    UpdateFailed = "UPDATE_FAILED" => 1,
    UpgradeFailed = "UPGRADE_FAILED" => 1,
}

#[derive(Debug, Clone)]
pub struct CommandError {
    pub code: ErrorCode,
    pub message: String,
    pub details: Option<Value>,
}

impl CommandError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details: None,
        }
    }

    pub fn details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }

    fn to_value(&self) -> Value {
        let mut map = Map::new();
        map.insert("code".into(), self.code.as_str().into());
        if let Some(details) = &self.details {
            map.insert("details".into(), details.clone());
        }
        map.insert("message".into(), self.message.clone().into());
        Value::Object(map)
    }
}

#[derive(Debug, Clone)]
pub struct Warning {
    pub code: String,
    pub message: String,
    pub details: Option<Value>,
}

impl Warning {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }

    fn to_value(&self) -> Value {
        let mut map = Map::new();
        map.insert("code".into(), self.code.clone().into());
        if let Some(details) = &self.details {
            map.insert("details".into(), details.clone());
        }
        map.insert("message".into(), self.message.clone().into());
        Value::Object(map)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetKind {
    Agent,
    Config,
    SelfTarget,
    System,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Target {
    pub kind: TargetKind,
    pub name: Option<String>,
}

impl Target {
    pub fn new(kind: TargetKind, name: Option<impl Into<String>>) -> Self {
        Self {
            kind,
            name: name.map(Into::into),
        }
    }

    pub fn system(name: &str) -> Self {
        Self::new(TargetKind::System, Some(name))
    }

    pub fn agent(name: &str) -> Self {
        Self::new(TargetKind::Agent, Some(name))
    }

    pub fn to_value(&self) -> Value {
        let kind = match self.kind {
            TargetKind::Agent => "agent",
            TargetKind::Config => "config",
            TargetKind::SelfTarget => "self",
            TargetKind::System => "system",
        };
        let mut map = Map::new();
        map.insert("kind".into(), kind.into());
        if let Some(name) = &self.name {
            map.insert("name".into(), name.clone().into());
        }
        Value::Object(map)
    }
}

/// Renders the human form of a result.
pub type HumanRenderer = fn(&Outcome, &mut Human);

/// What a command produced. The runtime turns it into an envelope or human output.
#[derive(Debug, Clone)]
pub struct Outcome {
    pub action: String,
    pub ok: bool,
    pub data: Option<Value>,
    pub error: Option<CommandError>,
    pub exit_code: Option<i32>,
    pub target: Option<Target>,
    pub warnings: Vec<Warning>,
    pub human: Option<HumanRenderer>,
}

impl Outcome {
    pub fn success(action: &str, target: Option<Target>, data: Value) -> Self {
        Self {
            action: action.into(),
            ok: true,
            data: Some(data),
            error: None,
            exit_code: None,
            target,
            warnings: Vec::new(),
            human: None,
        }
    }

    pub fn failure(action: &str, target: Option<Target>, error: CommandError) -> Self {
        Self {
            action: action.into(),
            ok: false,
            data: None,
            error: Some(error),
            exit_code: None,
            target,
            warnings: Vec::new(),
            human: None,
        }
    }

    pub fn with_data(mut self, data: Value) -> Self {
        self.data = Some(data);
        self
    }

    pub fn with_human(mut self, renderer: HumanRenderer) -> Self {
        self.human = Some(renderer);
        self
    }

    pub fn with_warning(mut self, warning: Warning) -> Self {
        self.warnings.push(warning);
        self
    }

    pub fn with_exit_code(mut self, code: i32) -> Self {
        self.exit_code = Some(code);
        self
    }

    /// The process exit code this outcome maps to.
    pub fn process_exit_code(&self) -> i32 {
        if let Some(code) = self.exit_code {
            return code;
        }
        if self.ok {
            return 0;
        }
        self.error.as_ref().map_or(1, |error| error.code.exit_code())
    }
}

fn meta(ctx: &Context, mode: OutputMode) -> Value {
    let mut map = Map::new();
    if let Some(freshness) = ctx.freshness() {
        map.insert("fetchedAt".into(), freshness.fetched_at.into());
        map.insert("source".into(), freshness.source.into());
        map.insert("staleAfter".into(), freshness.stale_after.into());
    }
    map.insert("mode".into(), mode.as_str().into());
    map.insert("runId".into(), ctx.run_id.clone().into());
    map.insert("schemaVersion".into(), SCHEMA_VERSION.into());
    map.insert("timestamp".into(), crate::time::now_iso().into());
    map.insert("version".into(), crate::VERSION.into());
    Value::Object(map)
}

/// Builds the result envelope for an outcome.
pub fn envelope(ctx: &Context, outcome: &Outcome, mode: OutputMode) -> Value {
    let mut map = Map::new();
    map.insert("action".into(), outcome.action.clone().into());
    if let Some(data) = &outcome.data {
        map.insert("data".into(), data.clone());
    }
    map.insert(
        "error".into(),
        outcome.error.as_ref().map_or(Value::Null, CommandError::to_value),
    );
    if let Some(code) = outcome.exit_code {
        map.insert("exitCode".into(), code.into());
    }
    map.insert("meta".into(), meta(ctx, mode));
    map.insert("ok".into(), outcome.ok.into());
    if let Some(target) = &outcome.target {
        map.insert("target".into(), target.to_value());
    }
    map.insert(
        "warnings".into(),
        Value::Array(outcome.warnings.iter().map(Warning::to_value).collect()),
    );
    Value::Object(map)
}

/// NDJSON event types.
#[derive(Debug, Clone, Copy)]
pub enum EventType {
    Cancelled,
    Progress,
    Result,
    Started,
}

impl EventType {
    fn as_str(self) -> &'static str {
        match self {
            Self::Cancelled => "cancelled",
            Self::Progress => "progress",
            Self::Result => "result",
            Self::Started => "started",
        }
    }
}

fn event(ctx: &Context, action: &str, kind: EventType, data: Option<Value>, target: Option<&Target>) -> Value {
    let mut map = Map::new();
    map.insert("action".into(), action.into());
    if let Some(data) = data {
        map.insert("data".into(), data);
    }
    map.insert("meta".into(), meta(ctx, OutputMode::Ndjson));
    if let Some(target) = target {
        map.insert("target".into(), target.to_value());
    }
    map.insert("type".into(), kind.as_str().into());
    Value::Object(map)
}

fn write_stdout(text: &str) {
    let stdout = std::io::stdout();
    let mut lock = stdout.lock();
    // A closed pipe is not an error worth reporting; the reader went away.
    let _ = lock.write_all(text.as_bytes());
    let _ = lock.flush();
}

/// Writes a final result in the context's output mode.
pub fn emit(ctx: &Context, outcome: &Outcome) {
    match ctx.output_mode {
        OutputMode::Json => {
            let text = serde_json::to_string_pretty(&envelope(ctx, outcome, OutputMode::Json)).unwrap();
            write_stdout(&format!("{text}\n"));
        }
        OutputMode::Ndjson => {
            let data = envelope(ctx, outcome, OutputMode::Ndjson);
            let line = event(
                ctx,
                &outcome.action,
                EventType::Result,
                Some(data),
                outcome.target.as_ref(),
            );
            write_stdout(&format!("{}\n", serde_json::to_string(&line).unwrap()));
        }
        OutputMode::Human => {
            let mut human = Human::new(ctx);
            match outcome.human {
                Some(render) => render(outcome, &mut human),
                None => default_human(outcome, &mut human),
            }
        }
    }
}

/// Writes an intermediate NDJSON event; other modes ignore it.
pub fn emit_event(ctx: &Context, action: &str, kind: EventType, data: Value, target: Option<&Target>) {
    if ctx.output_mode != OutputMode::Ndjson {
        return;
    }
    let line = event(ctx, action, kind, Some(data), target);
    write_stdout(&format!("{}\n", serde_json::to_string(&line).unwrap()));
}

/// Human fallback: errors to stderr, nothing for successes without a renderer.
pub fn default_human(outcome: &Outcome, human: &mut Human) {
    if let Some(error) = &outcome.error {
        human.error_line(&error.message);
    }
}

/// Convenience for details objects.
pub fn details(pairs: &[(&str, Value)]) -> Value {
    let mut map = Map::new();
    for (key, value) in pairs {
        map.insert((*key).into(), value.clone());
    }
    Value::Object(map)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_codes_match_the_contract() {
        let contract: Value = serde_json::from_str(include_str!("../../../contract/cli/error-codes.json")).unwrap();
        let expected: Vec<(String, i64)> = contract
            .as_array()
            .unwrap()
            .iter()
            .map(|entry| {
                (
                    entry["code"].as_str().unwrap().to_owned(),
                    entry["exitCode"].as_i64().unwrap(),
                )
            })
            .collect();
        let actual: Vec<(String, i64)> = ErrorCode::ALL
            .iter()
            .map(|code| (code.as_str().to_owned(), i64::from(code.exit_code())))
            .collect();
        assert_eq!(actual, expected);
    }

    #[test]
    fn json_macro_is_available() {
        assert_eq!(serde_json::json!({"a": 1})["a"], 1);
    }
}
