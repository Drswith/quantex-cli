## Context

`persistInstalledStateIfNotCancelled()` guards state writes with pre-await cancellation checks. Cancellation can still be set while `setInstalledAgentState()` is awaiting the atomic state write. The prior change explicitly deferred `trackInstalledAgent()` guards, but batch lifecycle cancellation design requires both paths to stop persisting after cancellation.

## Goals / Non-Goals

**Goals:**

- Skip or roll back installed-agent state when cancellation is observed after persistence completes.
- Apply the same guard to `trackInstalledAgent()`.
- Cover the post-await race with regression tests.

**Non-Goals:**

- Change timeout grace duration or runtime timeout emission semantics.
- Add managed-package rollback for adopt/track-only paths that never ran installers.

## Decisions

- After `await setInstalledAgentState()`, re-check `getCliContext().cancelled`; when true, remove the just-written agent state and return `null`.
- Keep managed-install rollback in `installAgent()` when persistence returns `null`.
- Change `trackInstalledAgent()` to return `InstalledAgentState | null` and have install/ensure treat `null` as cancelled failure.
- Re-check cancellation after the managed `updateAgent()` preferred-state persistence write.

## Risks / Trade-offs

- [Risk] Removing state after a completed write on cancel can briefly leave state inconsistent during rollback. → Mitigation: `removeInstalledAgentState()` runs in the same lifecycle lock.
- [Risk] Adopt/track callers must handle `null`. → Mitigation: narrow caller updates in install and ensure only.
