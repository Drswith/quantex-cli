## Context

Batch install already has cancellation regression coverage, but `updateAllAgents()` only checks `hasFailures` from per-agent statuses. When the update loop breaks on `getCliContext().cancelled`, skipped agents are omitted from `results` and the command can still return success.

## Goals / Non-Goals

- Goals: fail closed when `update --all` is cancelled before all planned update work completes; preserve partial `results` in the error payload.
- Non-Goals: redesign timeout semantics in `executeCommandWithRuntime`, change install batch cancellation reporting, or add fleet fingerprinting for idempotency.

## Decisions

- After `executePlannedUpdates()`, if `getCliContext().cancelled` is true, return `CANCELLED` with the partial `results` payload.
- Keep existing loop break behavior; only adjust final command status.

## Risks / Trade-offs

- Automation that previously treated partial success as completion will now see a failure code. That is the intended contract for cancelled batch updates.
