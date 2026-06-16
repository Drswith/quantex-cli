## Context

Idempotency persistence currently keys only on `result.ok`. Dry-run paths return `ok: true` with `DRY_RUN` warnings and no durable mutation. Batch install wiring in `cli.ts` passes `{ kind: 'agent' }` without `name`, so `idempotencyTargetsMatch` treats every batch install as the same target.

## Goals / Non-Goals

- Goals: prevent dry-run records from blocking real mutations; prevent batch install key collisions.
- Non-Goals: redesign idempotency storage format, add fleet fingerprinting for `update --all`, or change dry-run UX.

## Decisions

- Skip persistence when `getCliContext().dryRun` is true.
- Skip replay when the stored result includes a `DRY_RUN` warning.
- Encode batch install targets as sorted comma-joined agent names in `cli.ts`.
- Require `name` for `agent` kind targets during replay matching.

## Risks / Trade-offs

- `update --all` with `--idempotency-key` will no longer replay when the target omits `name`; this is safer than replaying stale fleet snapshots.
