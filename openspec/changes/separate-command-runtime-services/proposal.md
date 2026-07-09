## Why

`command-runtime.ts` currently combines timeout races, process-signal cancellation, idempotency policy and persistence, lifecycle-state validation, public output emission, and passive update notices. Separating command-neutral runtime decisions from CLI output mapping makes the execution contract directly testable without changing any published behavior.

## What Changes

- Add a command-neutral cancellation service for deadlines, grace-period completion, process signals, and cancellation cleanup.
- Add an idempotency service for replay eligibility, target matching, lifecycle validation, metadata refresh, and persistence decisions.
- Keep `executeCommandWithRuntime` as the public composition and output adapter.
- Preserve timeout, signal, idempotency, state-read error, NDJSON, human output, and passive self-update notice behavior.
- Add focused service tests while retaining the existing runtime compatibility suite.
- Make no breaking changes.

## Capabilities

### New Capabilities

- `command-runtime-services`: Defines the internal timeout, cancellation, idempotency, and output boundaries and their compatibility requirements.

### Modified Capabilities

None.

## Impact

- Code: `src/command-runtime.ts` and new focused modules under `src/services/`.
- Tests: `test/command-runtime.test.ts` and new service tests.
- No changes to CLI flags, result/event schemas, idempotency storage format, timeout values, error codes, state format, or release behavior.
