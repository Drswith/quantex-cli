use std::{
    collections::BTreeSet,
    fs,
    path::PathBuf,
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartManagerExt};
use tauri_plugin_notification::NotificationExt;

const INITIAL_CHECK_MINUTES: u64 = 2;
const INITIAL_CHECK_JITTER_MINUTES: u64 = 3;
const SCHEDULE_JITTER_MINUTES: u64 = 30;

#[derive(Clone)]
struct AppState {
    cancelled: Arc<AtomicBool>,
    active_pid: Arc<AtomicU32>,
    host: Arc<Mutex<DesktopHost>>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPreferences {
    check_frequency: CheckFrequency,
    launch_at_login: bool,
    notifications_enabled: bool,
}

impl Default for DesktopPreferences {
    fn default() -> Self {
        Self {
            check_frequency: CheckFrequency::Daily,
            launch_at_login: false,
            notifications_enabled: true,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum CheckFrequency {
    #[serde(rename = "6h")]
    SixHours,
    Daily,
    Disabled,
    Weekly,
}

impl CheckFrequency {
    fn interval(&self) -> Option<Duration> {
        match self {
            Self::SixHours => Some(Duration::from_secs(6 * 60 * 60)),
            Self::Daily => Some(Duration::from_secs(24 * 60 * 60)),
            Self::Weekly => Some(Duration::from_secs(7 * 24 * 60 * 60)),
            Self::Disabled => None,
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSnapshot {
    checked_at: Option<String>,
    error: Option<String>,
    results: Vec<UpdateResultItem>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateResultItem {
    display_name: String,
    hint: Option<String>,
    installed_version: Option<String>,
    latest_version: Option<String>,
    message: Option<String>,
    name: String,
    resource: Option<String>,
    status: String,
    strategy: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateExecution {
    error: Option<String>,
    name: String,
    result: Option<UpdateResultItem>,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PersistedDesktopState {
    notified_updates: BTreeSet<String>,
    preferences: DesktopPreferences,
    snapshot: DesktopSnapshot,
}

struct DesktopHost {
    persisted: PersistedDesktopState,
    next_check_at: Instant,
    retry_attempt: u8,
}

impl DesktopHost {
    fn load(app: &AppHandle) -> Result<Self, String> {
        let persisted = match fs::read_to_string(state_path(app)?) {
            Ok(contents) => serde_json::from_str(&contents)
                .map_err(|error| format!("Desktop preferences are unreadable: {error}"))?,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                PersistedDesktopState::default()
            }
            Err(error) => return Err(format!("Unable to read desktop preferences: {error}")),
        };
        Ok(Self {
            persisted,
            next_check_at: initial_due_at(),
            retry_attempt: 0,
        })
    }

    fn snapshot(&self) -> DesktopSnapshot {
        self.persisted.snapshot.clone()
    }

    fn preferences(&self) -> DesktopPreferences {
        self.persisted.preferences.clone()
    }

    fn update_preferences(
        &mut self,
        app: &AppHandle,
        preferences: DesktopPreferences,
    ) -> Result<DesktopPreferences, String> {
        self.persisted.preferences = preferences.clone();
        self.retry_attempt = 0;
        self.next_check_at = next_due_at(&preferences.check_frequency, 0);
        sync_autostart(app, preferences.launch_at_login)?;
        self.persist(app)?;
        Ok(preferences)
    }

    fn refresh(&mut self, app: &AppHandle, state: &AppState, background: bool) -> DesktopSnapshot {
        let checked_at = Utc::now().to_rfc3339();
        let result = run_cli_json(
            app,
            state,
            [
                "update",
                "--all",
                "--managed",
                "--dry-run",
                "--output",
                "json",
                "--non-interactive",
            ],
        );
        let snapshot = match result {
            Ok(envelope) => snapshot_from_envelope(checked_at, envelope),
            Err(error) => DesktopSnapshot {
                checked_at: Some(checked_at),
                error: Some(error),
                results: Vec::new(),
            },
        };

        let has_error = snapshot.error.is_some();
        self.persisted.snapshot = snapshot.clone();
        self.retry_attempt = if has_error {
            self.retry_attempt.saturating_add(1)
        } else {
            0
        };
        self.next_check_at = next_due_at(
            &self.persisted.preferences.check_frequency,
            self.retry_attempt,
        );
        if !has_error && background {
            self.notify_new_updates(app, &snapshot);
        }
        let _ = self.persist(app);
        snapshot
    }

    fn apply_updates(
        &mut self,
        app: &AppHandle,
        state: &AppState,
        names: Vec<String>,
    ) -> Result<Vec<UpdateExecution>, String> {
        if names.is_empty() {
            return Err("Select at least one available update.".to_string());
        }
        let allowed = self
            .persisted
            .snapshot
            .results
            .iter()
            .filter(|result| result.status == "planned")
            .map(|result| result.name.as_str())
            .collect::<BTreeSet<_>>();
        if names.iter().any(|name| !allowed.contains(name.as_str())) {
            return Err(
                "Refresh the managed update inventory before updating selected agents.".to_string(),
            );
        }

        state.cancelled.store(false, Ordering::SeqCst);
        let mut executions = Vec::with_capacity(names.len());
        for name in names {
            if state.cancelled.load(Ordering::SeqCst) {
                executions.push(UpdateExecution {
                    error: Some("Update cancelled before this agent started.".to_string()),
                    name,
                    result: None,
                });
                continue;
            }
            let execution = match run_cli_ndjson(
                app,
                state,
                ["update", &name, "--output", "ndjson", "--non-interactive"],
            ) {
                Ok(envelope) => UpdateExecution {
                    error: envelope.error.map(|error| error.message),
                    name: name.clone(),
                    result: envelope
                        .data
                        .and_then(|data| data.results.into_iter().next()),
                },
                Err(error) => UpdateExecution {
                    error: Some(error),
                    name: name.clone(),
                    result: None,
                },
            };
            self.persisted
                .notified_updates
                .retain(|key| !key.starts_with(&format!("{name}@")));
            executions.push(execution);
            if state.cancelled.load(Ordering::SeqCst) {
                break;
            }
        }
        self.persist(app)?;
        Ok(executions)
    }

    fn check_if_due(&mut self, app: &AppHandle, state: &AppState) {
        if self
            .persisted
            .preferences
            .check_frequency
            .interval()
            .is_none()
            || Instant::now() < self.next_check_at
        {
            return;
        }
        self.refresh(app, state, true);
    }

    fn notify_new_updates(&mut self, app: &AppHandle, snapshot: &DesktopSnapshot) {
        if !self.persisted.preferences.notifications_enabled {
            return;
        }
        let keys = notification_keys(&snapshot.results);
        let new_keys = keys
            .iter()
            .filter(|key| !self.persisted.notified_updates.contains(*key))
            .collect::<Vec<_>>();
        if new_keys.is_empty() {
            return;
        }
        let count = new_keys.len();
        let body = if count == 1 {
            "One managed agent update is ready for your confirmation.".to_string()
        } else {
            format!("{count} managed agent updates are ready for your confirmation.")
        };
        let _ = app
            .notification()
            .builder()
            .title("Quantex updates available")
            .body(body)
            .show();
        self.persisted.notified_updates.extend(keys);
    }

    fn persist(&self, app: &AppHandle) -> Result<(), String> {
        let path = state_path(app)?;
        let parent = path
            .parent()
            .ok_or_else(|| "Desktop state path has no parent.".to_string())?;
        fs::create_dir_all(parent)
            .map_err(|error| format!("Unable to create desktop data directory: {error}"))?;
        let payload = serde_json::to_string_pretty(&self.persisted)
            .map_err(|error| format!("Unable to serialize desktop preferences: {error}"))?;
        fs::write(path, format!("{payload}\n"))
            .map_err(|error| format!("Unable to save desktop preferences: {error}"))
    }
}

fn snapshot_from_envelope(checked_at: String, envelope: CliEnvelope) -> DesktopSnapshot {
    let CliEnvelope { data, error } = envelope;
    let results = data.map(|data| data.results).unwrap_or_default();
    DesktopSnapshot {
        checked_at: Some(checked_at),
        // A batch dry run can return an aggregate error when one agent's
        // probe failed. Keep that detail on the agent row instead of claiming
        // that the user initiated and failed an update.
        error: results
            .is_empty()
            .then(|| error.map(|error| error.message))
            .flatten(),
        results,
    }
}

#[derive(Deserialize)]
struct CliEnvelope {
    data: Option<UpdateCommandData>,
    error: Option<CliError>,
}

#[derive(Deserialize)]
struct CliError {
    message: String,
}

#[derive(Deserialize)]
struct UpdateCommandData {
    results: Vec<UpdateResultItem>,
}

#[tauri::command]
fn get_snapshot(state: tauri::State<'_, AppState>) -> Result<DesktopSnapshot, String> {
    state
        .host
        .lock()
        .map_err(|_| "Desktop host is unavailable.".to_string())
        .map(|host| host.snapshot())
}

#[tauri::command]
fn refresh_updates(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<DesktopSnapshot, String> {
    let mut host = state
        .host
        .lock()
        .map_err(|_| "Desktop host is unavailable.".to_string())?;
    Ok(host.refresh(&app, state.inner(), false))
}

#[tauri::command]
fn get_preferences(state: tauri::State<'_, AppState>) -> Result<DesktopPreferences, String> {
    state
        .host
        .lock()
        .map_err(|_| "Desktop host is unavailable.".to_string())
        .map(|host| host.preferences())
}

#[tauri::command]
fn update_preferences(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    preferences: DesktopPreferences,
) -> Result<DesktopPreferences, String> {
    state
        .host
        .lock()
        .map_err(|_| "Desktop host is unavailable.".to_string())?
        .update_preferences(&app, preferences)
}

#[tauri::command]
fn apply_updates(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    names: Vec<String>,
) -> Result<Vec<UpdateExecution>, String> {
    state
        .host
        .lock()
        .map_err(|_| "Desktop host is unavailable.".to_string())?
        .apply_updates(&app, state.inner(), names)
}

#[tauri::command]
fn cancel_updates(state: tauri::State<'_, AppState>) -> bool {
    state.cancelled.store(true, Ordering::SeqCst);
    let pid = state.active_pid.load(Ordering::SeqCst);
    if pid > 0 {
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
        return true;
    }
    false
}

#[tauri::command]
fn open_main_window(app: AppHandle) -> Result<(), String> {
    show_main_window(&app)
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn run_cli_json<const N: usize>(
    app: &AppHandle,
    state: &AppState,
    args: [&str; N],
) -> Result<CliEnvelope, String> {
    let output = run_cli(app, state, &args)?;
    serde_json::from_slice(&output.stdout).map_err(|error| format_cli_error(output.stderr, error))
}

fn run_cli_ndjson<const N: usize>(
    app: &AppHandle,
    state: &AppState,
    args: [&str; N],
) -> Result<CliEnvelope, String> {
    let output = run_cli(app, state, &args)?;
    output
        .stdout
        .split(|byte| *byte == b'\n')
        .filter_map(|line| serde_json::from_slice::<serde_json::Value>(line).ok())
        .find_map(|event| {
            (event.get("type").and_then(|value| value.as_str()) == Some("result"))
                .then(|| event.get("data").cloned())
                .flatten()
        })
        .ok_or_else(|| {
            format!(
                "Quantex did not emit a result event: {}",
                String::from_utf8_lossy(&output.stderr)
            )
        })
        .and_then(|result| {
            serde_json::from_value(result)
                .map_err(|error| format!("Invalid Quantex result event: {error}"))
        })
}

fn run_cli(
    app: &AppHandle,
    state: &AppState,
    args: &[&str],
) -> Result<std::process::Output, String> {
    let child = Command::new(cli_path(app)?)
        .args(args)
        .stderr(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start bundled Quantex CLI: {error}"))?;
    state.active_pid.store(child.id(), Ordering::SeqCst);
    let output = child
        .wait_with_output()
        .map_err(|error| format!("Unable to wait for Quantex CLI: {error}"));
    state.active_pid.store(0, Ordering::SeqCst);
    output
}

fn cli_path(app: &AppHandle) -> Result<PathBuf, String> {
    let binary = if cfg!(target_arch = "aarch64") {
        "quantex-darwin-arm64"
    } else {
        "quantex-darwin-x64"
    };
    let packaged = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Unable to resolve desktop resources: {error}"))?
        .join("resources/bin")
        .join(binary);
    if packaged.exists() {
        return Ok(packaged);
    }
    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources/bin")
        .join(binary);
    if development.exists() {
        return Ok(development);
    }
    Err(format!(
        "Bundled Quantex CLI is missing for this architecture: {binary}"
    ))
}

fn format_cli_error(stderr: Vec<u8>, error: serde_json::Error) -> String {
    let stderr = String::from_utf8_lossy(&stderr);
    if stderr.trim().is_empty() {
        format!("Quantex returned invalid JSON: {error}")
    } else {
        format!("Quantex returned invalid JSON: {error}. {stderr}")
    }
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("desktop-state.json"))
        .map_err(|error| format!("Unable to resolve desktop data directory: {error}"))
}

fn sync_autostart(app: &AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        app.autolaunch()
            .enable()
            .map_err(|error| format!("Unable to enable login launch: {error}"))
    } else {
        app.autolaunch()
            .disable()
            .map_err(|error| format!("Unable to disable login launch: {error}"))
    }
}

fn initial_due_at() -> Instant {
    Instant::now()
        + Duration::from_secs(
            (INITIAL_CHECK_MINUTES + pseudo_jitter(INITIAL_CHECK_JITTER_MINUTES)) * 60,
        )
}

fn next_due_at(frequency: &CheckFrequency, retry_attempt: u8) -> Instant {
    let retry = match retry_attempt {
        0 => None,
        1 => Some(Duration::from_secs(15 * 60)),
        _ => Some(Duration::from_secs(60 * 60)),
    };
    let duration = retry
        .or_else(|| frequency.interval())
        .unwrap_or(Duration::from_secs(u64::MAX / 2));
    let jitter = if retry.is_none() {
        Duration::from_secs(pseudo_jitter(SCHEDULE_JITTER_MINUTES) * 60)
    } else {
        Duration::ZERO
    };
    Instant::now() + duration + jitter
}

fn pseudo_jitter(max_minutes: u64) -> u64 {
    Utc::now().timestamp_subsec_nanos() as u64 % (max_minutes + 1)
}

fn notification_keys(results: &[UpdateResultItem]) -> BTreeSet<String> {
    results
        .iter()
        .filter(|result| result.status == "planned")
        .filter_map(|result| {
            result
                .latest_version
                .as_ref()
                .map(|version| format!("{}@{version}", result.name))
        })
        .collect()
}

fn show_main_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .show()
            .map_err(|error| format!("Unable to show desktop window: {error}"))?;
        window
            .set_focus()
            .map_err(|error| format!("Unable to focus desktop window: {error}"))?;
        return Ok(());
    }
    WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Quantex Desktop")
        .inner_size(1080.0, 720.0)
        .min_inner_size(860.0, 580.0)
        .build()
        .map(|_| ())
        .map_err(|error| format!("Unable to recreate desktop window: {error}"))
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Quantex Desktop", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;
    TrayIconBuilder::with_id("quantex-tray")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                let _ = show_main_window(app);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

fn start_scheduler(app: AppHandle, state: AppState) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(30));
        if let Ok(mut host) = state.host.lock() {
            host.check_if_due(&app, &state);
        }
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let host = DesktopHost::load(&app.handle())?;
            let state = AppState {
                active_pid: Arc::new(AtomicU32::new(0)),
                cancelled: Arc::new(AtomicBool::new(false)),
                host: Arc::new(Mutex::new(host)),
            };
            build_tray(&app.handle())?;
            start_scheduler(app.handle().clone(), state.clone());
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            apply_updates,
            cancel_updates,
            get_preferences,
            get_snapshot,
            open_main_window,
            quit_app,
            refresh_updates,
            update_preferences
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.destroy();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Quantex Desktop");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notification_keys_only_include_planned_versions() {
        let keys = notification_keys(&[
            UpdateResultItem {
                display_name: "Codex".to_string(),
                hint: None,
                installed_version: Some("1.0.0".to_string()),
                latest_version: Some("2.0.0".to_string()),
                message: None,
                name: "codex".to_string(),
                resource: None,
                status: "planned".to_string(),
                strategy: None,
            },
            UpdateResultItem {
                display_name: "Claude".to_string(),
                hint: None,
                installed_version: Some("1.0.0".to_string()),
                latest_version: Some("1.0.0".to_string()),
                message: None,
                name: "claude".to_string(),
                resource: None,
                status: "up-to-date".to_string(),
                strategy: None,
            },
        ]);
        assert_eq!(keys, BTreeSet::from(["codex@2.0.0".to_string()]));
    }

    #[test]
    fn disabled_frequency_has_no_interval() {
        assert!(CheckFrequency::Disabled.interval().is_none());
        assert_eq!(
            CheckFrequency::Daily.interval(),
            Some(Duration::from_secs(24 * 60 * 60))
        );
    }

    #[test]
    fn batch_probe_failure_stays_on_its_agent_row() {
        let snapshot = snapshot_from_envelope(
            "2026-08-03T08:00:00Z".to_string(),
            CliEnvelope {
                data: Some(UpdateCommandData {
                    results: vec![UpdateResultItem {
                        display_name: "Script agent".to_string(),
                        hint: None,
                        installed_version: None,
                        latest_version: None,
                        message: Some("Version probe failed".to_string()),
                        name: "script-agent".to_string(),
                        resource: None,
                        status: "failed".to_string(),
                        strategy: None,
                    }],
                }),
                error: Some(CliError {
                    message: "One or more agents failed to update.".to_string(),
                }),
            },
        );

        assert!(snapshot.error.is_none());
        assert_eq!(snapshot.results[0].status, "failed");
    }
}
