//! `config [get|set|reset] [key] [value]`.

use serde_json::{Map, Value, json};

use crate::context::Context;
use crate::protocol::{CommandError, ErrorCode, Outcome, Target, TargetKind, Warning};
use crate::store::{self, CONFIG_INTEGER_KEYS};
use crate::term::Human;

fn target(key: Option<&str>) -> Option<Target> {
    Some(Target::new(TargetKind::Config, key))
}

fn invalid(key: Option<&str>, message: &str) -> Outcome {
    Outcome::failure(
        "config",
        target(key),
        CommandError::new(ErrorCode::InvalidArgument, message),
    )
    .with_human(render)
}

pub fn run(ctx: &Context, action: Option<&str>, key: Option<&str>, value: Option<&str>) -> Outcome {
    let dir = ctx.quantex_dir();
    let Some(action) = action else {
        let config = store::load_config(&dir);
        return Outcome::success(
            "config",
            target(None),
            json!({ "action": "list", "config": config.values }),
        )
        .with_human(render);
    };
    match action {
        "get" => {
            let Some(key) = key else {
                return invalid(None, "Please specify a key");
            };
            let config = store::load_config(&dir);
            let mut data = Map::new();
            data.insert("action".into(), "get".into());
            data.insert("key".into(), key.into());
            if let Some(found) = config
                .values
                .get(key)
                .filter(|found| found.is_number() || found.is_string())
            {
                data.insert("value".into(), found.clone());
            }
            Outcome::success("config", target(Some(key)), Value::Object(data)).with_human(render)
        }
        "set" => {
            let (Some(key), Some(raw)) = (key, value) else {
                return invalid(None, "Please specify both key and value");
            };
            let invalid_value = match key {
                "defaultPackageManager" if !matches!(raw, "bun" | "npm" | "mise" | "uv") => {
                    Some("defaultPackageManager must be bun, npm, mise, or uv".to_owned())
                }
                "npmBunUpdateStrategy" if !matches!(raw, "latest-major" | "respect-semver") => {
                    Some("npmBunUpdateStrategy must be latest-major or respect-semver".to_owned())
                }
                "selfUpdateChannel" if !matches!(raw, "stable" | "beta") => {
                    Some("selfUpdateChannel must be stable or beta".to_owned())
                }
                "selfUpdateRegistry" if store::normalize_registry_url(raw).is_none() => {
                    Some("selfUpdateRegistry must be a valid absolute URL".to_owned())
                }
                _ if CONFIG_INTEGER_KEYS.contains(&key) && !store::parse_int_prefix(raw).is_some_and(|n| n > 0) => {
                    Some(format!("{key} must be a positive integer"))
                }
                _ => None,
            };
            if let Some(message) = invalid_value {
                return invalid(Some(key), &message);
            }
            let stored: Value = if CONFIG_INTEGER_KEYS.contains(&key) {
                store::parse_int_prefix(raw).unwrap_or_default().into()
            } else if key == "selfUpdateRegistry" {
                store::normalize_registry_url(raw).unwrap_or_default().into()
            } else {
                raw.into()
            };
            let mut values = store::load_config(&dir).values;
            values.insert(key.into(), stored.clone());
            if let Err(error) = store::save_config(&dir, &values) {
                return Outcome::failure(
                    "config",
                    target(Some(key)),
                    CommandError::new(ErrorCode::InvalidArgument, format!("Failed to write config: {error}")),
                );
            }
            Outcome::success(
                "config",
                target(Some(key)),
                json!({ "action": "set", "key": key, "value": stored }),
            )
            .with_human(render)
        }
        "reset" => {
            let defaults = store::default_config();
            if let Err(error) = store::save_config(&dir, &defaults) {
                return Outcome::failure(
                    "config",
                    target(None),
                    CommandError::new(ErrorCode::InvalidArgument, format!("Failed to write config: {error}")),
                );
            }
            Outcome::success("config", target(None), json!({ "action": "reset", "config": defaults }))
                .with_human(render)
        }
        other => Outcome::failure(
            "config",
            target(None),
            CommandError::new(ErrorCode::InvalidArgument, format!("Unknown action: {other}"))
                .details(json!({ "action": other })),
        )
        .with_warning(Warning::new("AVAILABLE_ACTIONS", "Available actions: get, set, reset"))
        .with_human(render),
    }
}

fn render(outcome: &Outcome, human: &mut Human) {
    if let Some(error) = &outcome.error {
        human.error_line(&error.message);
        for warning in &outcome.warnings {
            eprintln!("{}", warning.message);
        }
        return;
    }
    let Some(data) = &outcome.data else { return };
    match data["action"].as_str() {
        Some("list") => {
            human.heading("Current Configuration:");
            human.line(&serde_json::to_string_pretty(&data["config"]).unwrap());
            human.blank();
        }
        Some("get") => match &data["value"] {
            Value::String(text) => human.line(text),
            Value::Null => {
                let text = human.dim("(not set)");
                human.line(&text);
            }
            other => human.line(&other.to_string()),
        },
        Some("set") => {
            let value = match &data["value"] {
                Value::String(text) => text.clone(),
                other => other.to_string(),
            };
            let text = human.green(&format!("Set {} = {value}", data["key"].as_str().unwrap_or_default()));
            human.line(&text);
        }
        Some("reset") => {
            let text = human.green("Configuration reset to defaults.");
            human.line(&text);
        }
        _ => {}
    }
}
