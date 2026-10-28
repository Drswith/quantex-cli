//! Per-invocation settings resolved from global options and the environment.

use std::io::IsTerminal;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::protocol::{CommandError, ErrorCode, OutputMode};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ColorMode {
    Auto,
    Always,
    Never,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum LogLevel {
    Silent,
    Error,
    Warn,
    Info,
    Debug,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CacheMode {
    Default,
    NoCache,
    Refresh,
}

/// Freshness of cached metadata used to build a result.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Freshness {
    pub fetched_at: String,
    pub source: &'static str,
    pub stale_after: String,
}

/// Raw global options as parsed from argv.
#[derive(Debug, Clone, Default)]
pub struct GlobalArgs {
    pub json: bool,
    pub output: Option<String>,
    pub non_interactive: bool,
    pub yes: bool,
    pub quiet: bool,
    pub color: Option<String>,
    pub log_level: Option<String>,
    pub dry_run: bool,
    pub refresh: bool,
    pub no_cache: bool,
    pub run_id: Option<String>,
    pub idempotency_key: Option<String>,
    pub timeout: Option<String>,
}

impl GlobalArgs {
    /// The output mode these options select. Without an explicit choice the mode is
    /// human, matching v1 (see `contract/README.md`).
    pub fn output_mode(&self) -> OutputMode {
        if self.json {
            return OutputMode::Json;
        }
        match self.output.as_deref() {
            Some("json") => OutputMode::Json,
            Some("ndjson") => OutputMode::Ndjson,
            _ => OutputMode::Human,
        }
    }
}

#[derive(Debug)]
pub struct Context {
    pub output_mode: OutputMode,
    pub color_mode: ColorMode,
    pub log_level: LogLevel,
    pub quiet: bool,
    pub yes: bool,
    pub dry_run: bool,
    pub non_interactive: bool,
    /// True when prompts may be shown: not disabled and both streams are terminals.
    pub interactive: bool,
    pub cache_mode: CacheMode,
    pub run_id: String,
    pub timeout_ms: Option<u64>,
    pub idempotency_key: Option<String>,
    pub home: PathBuf,
    freshness: Mutex<Option<Freshness>>,
    cancelled: AtomicBool,
}

impl Context {
    pub fn resolve(args: &GlobalArgs) -> Result<Self, CommandError> {
        let color_mode = match args.color.as_deref() {
            None | Some("auto") => ColorMode::Auto,
            Some("always") => ColorMode::Always,
            Some("never") => ColorMode::Never,
            Some(other) => {
                return Err(invalid(format!("Invalid color mode: {other}"), "color", other));
            }
        };
        let log_level = match args.log_level.as_deref() {
            None | Some("info") => LogLevel::Info,
            Some("silent") => LogLevel::Silent,
            Some("error") => LogLevel::Error,
            Some("warn") => LogLevel::Warn,
            Some("debug") => LogLevel::Debug,
            Some(other) => {
                return Err(invalid(format!("Invalid log level: {other}"), "log-level", other));
            }
        };
        let timeout_ms = match args.timeout.as_deref() {
            None => None,
            Some(text) => match parse_duration_ms(text) {
                Some(ms) => Some(ms),
                None => {
                    return Err(invalid(format!("Invalid timeout value: {text}"), "timeout", text));
                }
            },
        };
        if args.refresh && args.no_cache {
            return Err(
                CommandError::new(ErrorCode::InvalidArgument, "Cannot combine --refresh with --no-cache.")
                    .details(serde_json::json!({ "options": ["--refresh", "--no-cache"] })),
            );
        }
        let terminals = std::io::stdin().is_terminal() && std::io::stdout().is_terminal();
        let run_id = args
            .run_id
            .clone()
            .or_else(|| std::env::var("QUANTEX_RUN_ID").ok().filter(|value| !value.is_empty()))
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        Ok(Self {
            output_mode: args.output_mode(),
            color_mode,
            log_level,
            quiet: args.quiet,
            yes: args.yes,
            dry_run: args.dry_run,
            non_interactive: args.non_interactive,
            interactive: !args.non_interactive && terminals,
            cache_mode: if args.no_cache {
                CacheMode::NoCache
            } else if args.refresh {
                CacheMode::Refresh
            } else {
                CacheMode::Default
            },
            run_id,
            timeout_ms,
            idempotency_key: args.idempotency_key.clone(),
            home: home_dir(),
            freshness: Mutex::new(None),
            cancelled: AtomicBool::new(false),
        })
    }

    /// A context for reporting errors when the options themselves are invalid: the
    /// output mode is honoured and every other invalid value falls back to its default.
    pub fn lenient(args: &GlobalArgs) -> Self {
        let mut relaxed = args.clone();
        relaxed.color = None;
        relaxed.log_level = None;
        relaxed.timeout = None;
        relaxed.no_cache = false;
        Self::resolve(&relaxed).expect("default options always resolve")
    }

    /// The `~/.quantex` directory.
    pub fn quantex_dir(&self) -> PathBuf {
        self.home.join(".quantex")
    }

    pub fn freshness(&self) -> Option<Freshness> {
        self.freshness.lock().unwrap().clone()
    }

    /// Merges freshness the way v1 did: the oldest fetch and earliest staleness win,
    /// and the source stays `network` only if every contribution came from the network.
    pub fn record_freshness(&self, next: Freshness) {
        let mut guard = self.freshness.lock().unwrap();
        *guard = Some(match guard.take() {
            None => next,
            Some(current) => Freshness {
                fetched_at: std::cmp::min(current.fetched_at, next.fetched_at),
                source: if current.source == "network" && next.source == "network" {
                    "network"
                } else {
                    "cache"
                },
                stale_after: std::cmp::min(current.stale_after, next.stale_after),
            },
        });
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
        crate::process::kill_tracked_children();
    }

    pub fn logs_at(&self, level: LogLevel) -> bool {
        self.log_level >= level && !(self.quiet && level >= LogLevel::Info)
    }
}

fn invalid(message: String, option: &str, value: &str) -> CommandError {
    CommandError::new(ErrorCode::InvalidArgument, message)
        .details(serde_json::json!({ "option": format!("--{option}"), "value": value }))
}

/// Parses `500`, `500ms`, `30s`, `5m`, `1h` into milliseconds.
pub fn parse_duration_ms(text: &str) -> Option<u64> {
    let text = text.trim();
    let digits_end = text.find(|c: char| !c.is_ascii_digit()).unwrap_or(text.len());
    if digits_end == 0 {
        return None;
    }
    let amount: u64 = text[..digits_end].parse().ok()?;
    let factor = match &text[digits_end..] {
        "" | "ms" => 1,
        "s" => 1000,
        "m" => 60_000,
        "h" => 3_600_000,
        _ => return None,
    };
    amount.checked_mul(factor)
}

/// The user's home directory: `HOME`, then `USERPROFILE` on Windows.
pub fn home_dir() -> PathBuf {
    let candidates: &[&str] = if cfg!(windows) {
        &["USERPROFILE", "HOME"]
    } else {
        &["HOME", "USERPROFILE"]
    };
    for key in candidates {
        if let Some(value) = std::env::var_os(key).filter(|value| !value.is_empty()) {
            return PathBuf::from(value);
        }
    }
    PathBuf::from(".")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn durations_parse_like_v1() {
        assert_eq!(parse_duration_ms("500"), Some(500));
        assert_eq!(parse_duration_ms("500ms"), Some(500));
        assert_eq!(parse_duration_ms("30s"), Some(30_000));
        assert_eq!(parse_duration_ms("5m"), Some(300_000));
        assert_eq!(parse_duration_ms("1h"), Some(3_600_000));
        assert_eq!(parse_duration_ms(" 2s "), Some(2000));
        assert_eq!(parse_duration_ms("soon"), None);
        assert_eq!(parse_duration_ms("1.5s"), None);
        assert_eq!(parse_duration_ms(""), None);
    }
}
