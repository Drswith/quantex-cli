## Context

Install cancellation after persistence removes just-written state and rolls back the managed install because the package mutation can be undone. Update cancellation after persistence cannot undo the package upgrade, and the recorded install source remains accurate.

## Goals / Non-Goals

- Goals: preserve installed-agent state when a managed update is cancelled after persistence; keep failure reporting for cancelled updates.
- Non-Goals: downgrade packages on update cancellation, change install cancellation semantics, or redesign timeout/idempotency behavior.

## Decisions

- Do not call `removeInstalledAgentState()` from `updateAgent()` when cancellation is observed after persistence.
- Reuse the existing cancellation checks before persistence and continue returning `{ success: false }` for cancelled updates.

## Risks / Trade-offs

- Callers may see update failure even though the package was upgraded. That is preferable to silently losing install-source tracking.
