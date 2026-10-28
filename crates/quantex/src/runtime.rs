//! Runs a management command: deadline, SIGINT / SIGTERM cancellation, and output.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::time::{Duration, Instant};

use serde_json::json;

use crate::context::Context;
use crate::protocol::{self, CommandError, ErrorCode, EventType, Outcome, Target};

static SIGINT: AtomicBool = AtomicBool::new(false);
static SIGTERM: AtomicBool = AtomicBool::new(false);

/// Installs SIGINT / SIGTERM handlers that only record the signal; the runtime decides
/// what to do with it.
pub fn install_signal_handlers() {
    #[cfg(unix)]
    {
        let sigint = Arc::new(AtomicBool::new(false));
        let sigterm = Arc::new(AtomicBool::new(false));
        let _ = signal_hook::flag::register(signal_hook::consts::SIGINT, Arc::clone(&sigint));
        let _ = signal_hook::flag::register(signal_hook::consts::SIGTERM, Arc::clone(&sigterm));
        std::thread::spawn(move || {
            loop {
                if sigint.swap(false, Ordering::SeqCst) {
                    SIGINT.store(true, Ordering::SeqCst);
                }
                if sigterm.swap(false, Ordering::SeqCst) {
                    SIGTERM.store(true, Ordering::SeqCst);
                }
                std::thread::sleep(Duration::from_millis(10));
            }
        });
    }
    #[cfg(windows)]
    {
        let _ = ctrlc::set_handler(|| SIGINT.store(true, Ordering::SeqCst));
    }
}

fn take_signal() -> Option<&'static str> {
    if SIGINT.swap(false, Ordering::SeqCst) {
        return Some("SIGINT");
    }
    if SIGTERM.swap(false, Ordering::SeqCst) {
        return Some("SIGTERM");
    }
    None
}

/// Runs `work` on a worker thread and emits its outcome, or a `TIMEOUT` / `CANCELLED`
/// outcome when the deadline passes or a signal arrives first. Returns the exit code.
pub fn execute<F>(ctx: Arc<Context>, action: &str, target: Option<Target>, work: F) -> i32
where
    F: FnOnce(&Context) -> Outcome + Send + 'static,
{
    let (sender, receiver) = mpsc::channel();
    let worker_ctx = Arc::clone(&ctx);
    std::thread::spawn(move || {
        let outcome = work(&worker_ctx);
        let _ = sender.send(outcome);
    });
    let deadline = ctx.timeout_ms.map(|ms| Instant::now() + Duration::from_millis(ms));
    loop {
        if let Some(signal) = take_signal() {
            return cancel(
                &ctx,
                action,
                target.as_ref(),
                json!({ "reason": "signal", "signal": signal }),
                CommandError::new(ErrorCode::Cancelled, format!("Command cancelled by {signal}."))
                    .details(json!({ "signal": signal })),
            );
        }
        let wait = match deadline {
            Some(deadline) => deadline
                .saturating_duration_since(Instant::now())
                .min(Duration::from_millis(20)),
            None => Duration::from_millis(20),
        };
        match receiver.recv_timeout(wait) {
            Ok(outcome) if !ctx.deadline_hit() => return finish(&ctx, outcome),
            Ok(_) => return timeout(&ctx, action, target.as_ref()),
            Err(RecvTimeoutError::Timeout) => {
                let Some(deadline) = deadline else { continue };
                if Instant::now() < deadline {
                    continue;
                }
                // A command that is just finishing still gets to report its own result,
                // unless the deadline already cut part of its work short.
                let grace = Duration::from_millis(ctx.timeout_ms.unwrap_or_default().min(250));
                if let Ok(outcome) = receiver.recv_timeout(grace)
                    && !ctx.deadline_hit()
                    && outcome
                        .error
                        .as_ref()
                        .is_none_or(|error| error.code != ErrorCode::Timeout)
                {
                    return finish(&ctx, outcome);
                }
                return timeout(&ctx, action, target.as_ref());
            }
            Err(RecvTimeoutError::Disconnected) => {
                eprintln!("quantex: {action} stopped unexpectedly");
                return 1;
            }
        }
    }
}

fn finish(ctx: &Context, outcome: Outcome) -> i32 {
    if ctx.is_cancelled() {
        return outcome.process_exit_code();
    }
    protocol::emit(ctx, &outcome);
    crate::commands::after_success(ctx, &outcome);
    outcome.process_exit_code()
}

fn timeout(ctx: &Context, action: &str, target: Option<&Target>) -> i32 {
    let timeout_ms = ctx.timeout_ms.unwrap_or_default();
    cancel(
        ctx,
        action,
        target,
        json!({ "reason": "timeout", "timeoutMs": timeout_ms }),
        CommandError::new(ErrorCode::Timeout, format!("Command timed out after {timeout_ms}ms."))
            .details(json!({ "timeoutMs": timeout_ms })),
    )
}

fn cancel(ctx: &Context, action: &str, target: Option<&Target>, event: serde_json::Value, error: CommandError) -> i32 {
    ctx.cancel();
    protocol::emit_event(ctx, action, EventType::Cancelled, event, target);
    let outcome = Outcome::failure(action, target.cloned(), error);
    protocol::emit(ctx, &outcome);
    outcome.process_exit_code()
}
