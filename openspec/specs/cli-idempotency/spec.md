# cli-idempotency Specification

## Purpose

Define when Quantex mutating commands persist and replay idempotency records for client-supplied retry keys.
## Requirements
### Requirement: Idempotency MUST replay only successful completions

Mutating commands that accept `--idempotency-key` SHALL persist idempotency records only when the primary command result is successful (`ok: true`) and the invocation is not a dry run.

#### Scenario: Successful mutating command is replayed

- GIVEN a mutating command completes with `ok: true`
- AND the caller supplied `--idempotency-key <key>`
- AND the invocation was not a dry run
- WHEN the same command is invoked again with the same key, action, and target before the record expires
- THEN Quantex replays the stored successful result without re-executing the primary command work

#### Scenario: Dry run does not persist or replay as a real mutation

- GIVEN a mutating command completes with `ok: true` during `--dry-run`
- AND the caller supplied `--idempotency-key <key>`
- WHEN the same command is invoked again without `--dry-run` using the same key, action, and target
- THEN Quantex does not replay the dry-run result
- AND it executes the real mutating command work

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

#### Scenario: Batch install target mismatch does not replay the wrong agents

- GIVEN an idempotency record exists for key `<key>`, action `install`, and target agents `codex,cursor`
- WHEN `install` is invoked again with the same key but target agents `vtcode`
- THEN Quantex does not replay the stored batch result
- AND it executes the `vtcode` install work

#### Scenario: Successful completion after timeout deadline is reported as success

- GIVEN a mutating command is invoked with `--timeout` and `--idempotency-key`
- AND the primary command work completes with `ok: true` after the timeout deadline fired
- WHEN the runtime finalizes the command result
- THEN Quantex returns the successful result
- AND it persists the idempotency record for the successful completion

### Requirement: Idempotency filenames MUST be collision-safe for distinct client keys

Quantex SHALL map each distinct `--idempotency-key` value to a distinct on-disk record filename so sanitization cannot merge unrelated client keys.

#### Scenario: Distinct keys that previously sanitized to the same filename remain independent

- GIVEN a successful mutating command stored with idempotency key `job-1/install/codex`
- WHEN a different mutating command is invoked with idempotency key `job-1_install_codex`
- THEN Quantex does not replay the first command's stored result
- AND it executes the new command work independently

