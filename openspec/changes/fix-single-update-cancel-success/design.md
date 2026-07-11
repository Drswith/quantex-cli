## Context

`update --all` already fail-closes when `getCliContext().cancelled` is true after `executePlannedUpdates()`. Single-agent `update` shares the same execution helper but only checks `hasFailures` / lock errors before returning success.

Cancellation can leave `hasFailures === false` when:

- a managed group update succeeds, then cancel is observed before command return
- `updateAgent` self-update path returns `{ success: true }` without a post-cancel check
- cancel fires after a successful per-agent update result is recorded

## Goals / Non-Goals

**Goals:**

- Single-agent `update` must not report overall success when cancelled.
- Preserve partial `results` in the cancelled payload when available.
- Keep the fix narrow and aligned with the batch-update cancel contract.

**Non-Goals:**

- Reworking package-manager cancel semantics beyond what the command-layer guard needs.
- Changing uninstall / ensure / idempotency persistence in this change.
- Broad self-upgrade AbortSignal work.

## Decisions

1. Mirror the `updateAllAgents` cancel guard in `updateSingleAgent` after `executePlannedUpdates` and lock handling.
2. Use `error.code: 'CANCELLED'` and keep `scope: 'single'` with any partial `results`.
3. Cover with a unit test that cancels inside a mocked `updateAgent` call, matching the batch regression style.

## Risks / Trade-offs

- Managed update that already completed may still have mutated the package; the command correctly reports cancellation rather than success. Callers must treat `CANCELLED` as incomplete/uncertain, same as batch update.
