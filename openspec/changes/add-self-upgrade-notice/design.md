## Overview

Add a post-command human reminder for outdated Quantex installs without changing command result payloads or forcing explicit update checks. The reminder should be best-effort, cheap on repeated invocations, and invisible to machine-facing modes.

## Decisions

- Hook the reminder into `executeCommandWithRuntime()` after the command result has been emitted and persisted for idempotency.
- Limit the reminder to successful human-mode runtime commands.
- Skip commands that already own self-upgrade messaging, specifically `upgrade` and `doctor`.
- Reuse `inspectSelf()` for version resolution so the notice follows the same install-source and registry logic as explicit self-upgrade checks.
- Store reminder throttle state in `state.json` under `self`, keyed by the last reminded target version and timestamp.

## Reminder Rules

- Only consider showing a reminder when:
  - `outputMode === "human"`
  - `quiet !== true`
  - the command result is successful
  - the action is not `upgrade` or `doctor`
- Show a reminder only when `inspection.latestVersion` exists and differs from `inspection.currentVersion`.
- If `inspection.canAutoUpdate` is true, suggest `quantex upgrade`.
- If `inspection.canAutoUpdate` is false, suggest `quantex doctor` for source-specific remediation.
- Suppress repeated reminders for the same target version until at least 24 hours have elapsed.
- Show a new reminder immediately when a newer target version than the last reminded version appears.

## State Shape

Extend `state.self` with:

- `updateNoticeVersion?: string`
- `updateNoticeAt?: string`

This keeps the throttle local to self-upgrade state and avoids introducing a separate persistence file.

## Testing

- Add state tests for persisting the update-notice markers.
- Add runtime tests for:
  - showing the reminder in human mode when outdated
  - suppressing it in structured modes
  - suppressing it for `upgrade` and `doctor`
  - suppressing repeat reminders inside the throttle window
  - re-showing when the available version changes
