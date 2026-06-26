## Context

`installAgent()` rolls back managed installs when cancellation prevents persistence and removes just-written state only for fresh installs. `updateAgent()` reuses the post-persistence cancellation branch from install and calls `removeInstalledAgentState()` even when the agent was already tracked and the managed update already succeeded.

## Goals / Non-Goals

**Goals:**

- Preserve tracked install state when a recorded managed update succeeds but cancellation fires during persistence.
- Roll back catalog-fallback managed updates when persistence is cancelled, matching install semantics.
- Cover both paths with regression tests.

**Non-Goals:**

- Revert package versions after a completed managed update.
- Change timeout grace duration or runtime timeout emission semantics.
- Add rollback for script/binary update paths.

## Decisions

- On the preferred-state update path, return `{ success: false }` after cancellation without removing existing installed-agent state.
- On the catalog fallback update path, call `rollbackManagedInstall()` when `persistInstalledStateIfNotCancelled()` returns `null`.
- Keep the post-update cancellation check before `setInstalledAgentState()` unchanged so callers still observe failure when cancelled before persistence.

## Risks / Trade-offs

- [Risk] Callers may observe update failure while the package is already upgraded. → Acceptable: tracked state remains, matching pre-0.25.2 behavior for recorded installs and avoiding untracked drift.
- [Risk] Catalog fallback rollback uninstalls a package that may have existed before Quantex tracked it. → Matches existing install rollback semantics for the same path.
