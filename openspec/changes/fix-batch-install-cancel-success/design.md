## Context

Batch install already stops the loop when `getCliContext().cancelled` is true, but `installCommand()` only checks `hasFailures` from per-agent statuses. When the install loop breaks after a successful first agent, skipped agents are omitted from `results` and the command can still return success. `update --all` had the same gap and was fixed in `fix-update-all-cancel-success`.

## Goals / Non-Goals

- Goals: fail closed on partial batch install when cancellation interrupts processing.
- Non-Goals: redesign timeout semantics in `executeCommandWithRuntime`, change single-agent install cancellation reporting, or add fleet fingerprinting for idempotency.

## Decisions

- After the batch install loop, if `getCliContext().cancelled` is true and fewer agents were processed than requested, return `CANCELLED` with partial `results`.
- Mirror the `updateAllAgents()` post-execution cancellation check.

## Risks / Trade-offs

- Automation that previously treated partial success as completion will now see a failure code. That is the intended contract for cancelled batch installs.

## Migration Plan

- Patch release only; no migration required.
