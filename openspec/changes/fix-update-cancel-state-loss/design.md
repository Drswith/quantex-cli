## Context

`updateAgent()` with recorded `preferredState` runs the managed update first, then re-writes the same install-source metadata. The shared post-persistence cancellation guard calls `removeInstalledAgentState()`, which deletes the agent entry entirely. Unlike install, there is no managed-package rollback for updates, so the on-disk agent remains upgraded while Quantex forgets how it was installed.

## Goals / Non-Goals

**Goals:**

- Keep recorded install state when cancellation turns a managed update into a non-success outcome after package work succeeds.
- Preserve existing install/adopt cancellation rollback semantics.

**Non-Goals:**

- Add managed-package version rollback for cancelled updates.
- Change timeout grace duration or runtime cancellation emission.

## Decisions

- Split cancellation handling between install/adopt persistence and update re-persistence.
- For managed updates with recorded state, skip `removeInstalledAgentState()` when cancellation is observed after `setInstalledAgentState()`; return `{ success: false }` only.
- Leave `persistInstalledStateIfNotCancelled()` unchanged for fresh install and adopt/track writes.

## Risks / Trade-offs

- [Risk] Callers still observe failure while the agent binary was upgraded. → Acceptable: metadata preservation is more important than pretending the update never happened; callers already handle cancelled outcomes.
- [Risk] Divergence from install rollback semantics. → Mitigated by spec scenario that distinguishes update re-persistence from fresh install writes.
