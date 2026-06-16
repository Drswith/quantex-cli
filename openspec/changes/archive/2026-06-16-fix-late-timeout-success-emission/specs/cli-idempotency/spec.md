## MODIFIED Requirements

### Requirement: Idempotency MUST replay only successful completions

Mutating commands that accept `--idempotency-key` SHALL persist idempotency records only when the primary command result is successful (`ok: true`).

#### Scenario: Successful mutating command is replayed

- GIVEN a mutating command completes with `ok: true`
- AND the caller supplied `--idempotency-key <key>`
- WHEN the same command is invoked again with the same key, action, and target before the record expires
- THEN Quantex replays the stored successful result without re-executing the primary command work

#### Scenario: Transient failure does not block retry

- GIVEN a mutating command completes with `ok: false` (for example `TIMEOUT`, `CANCELLED`, or `INSTALL_FAILED`)
- AND the caller supplied `--idempotency-key <key>`
- WHEN the same command is invoked again with the same key and action
- THEN Quantex does not replay the prior failure
- AND it re-executes the primary command work

#### Scenario: Action mismatch remains protected

- GIVEN an idempotency record exists for key `<key>` and action `install`
- WHEN a different action is invoked with the same key
- THEN Quantex returns `INVALID_ARGUMENT`
- AND it does not execute the new action

#### Scenario: Target mismatch does not replay the wrong agent

- GIVEN an idempotency record exists for key `<key>`, action `install`, and target agent `codex`
- WHEN `install` is invoked again with the same key but target agent `cursor`
- THEN Quantex does not replay the stored `codex` result
- AND it executes the `cursor` install work

#### Scenario: Successful completion after timeout deadline is reported as success

- GIVEN a mutating command is invoked with `--timeout` and `--idempotency-key`
- AND the primary command work completes with `ok: true` after the timeout deadline fired
- WHEN the runtime finalizes the command result
- THEN Quantex returns the successful result
- AND it persists the idempotency record for the successful completion
- AND structured output mode does not emit a `TIMEOUT` result or ndjson `cancelled` event for that invocation
- AND the process exit code matches the successful result
