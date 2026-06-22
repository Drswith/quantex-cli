## Context

`installAgent()` persists installed-agent state after managed subprocess success. Timeout cancellation is deferred until a late-completion grace window expires, but the grace race only waits on the full `installAgent()` promise. When the subprocess exits early in the grace window and state persistence is slow, cancellation can fire before `setInstalledAgentState()` completes.

## Goals / Non-Goals

**Goals:**

- Skip installed-agent state persistence when CLI context is cancelled.
- Roll back managed installs when persistence is skipped after a successful subprocess.
- Cover the race with regression tests.

**Non-Goals:**

- Change grace-window duration or timeout emission semantics.
- Add cancellation checks to explicit `trackInstalledAgent()` calls.

## Decisions

- Check `getCliContext().cancelled` immediately before `setInstalledAgentState()` inside `persistInstalledState()`, and again at `installAgent()` / `updateAgent()` call sites after `executeMethod()` succeeds.
- Return `{ success: false }` from `installAgent()` when cancelled, invoking existing `rollbackManagedInstall()` for managed methods.
- Reuse the same guard for managed `updateAgent()` persistence paths.

## Risks / Trade-offs

- [Risk] A cancelled install that already wrote state before the guard runs could leave stale state. → Mitigation: check cancelled immediately before the write; post-write cancel is rare and covered by rollback on the install path.
- [Risk] Slightly longer install path when not cancelled. → Mitigation: single boolean read.
