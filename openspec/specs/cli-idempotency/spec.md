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

#### Scenario: Install replay is skipped after the agent was removed

- GIVEN a successful `install` idempotency record exists for key `<key>` and target agent `codex`
- AND `codex` is no longer installed in `PATH`
- WHEN `install` is invoked again with the same key, action, and target
- THEN Quantex does not replay the stored install success
- AND it executes the `codex` install work

#### Scenario: Uninstall replay is skipped after the agent was reinstalled

- GIVEN a successful `uninstall` idempotency record exists for key `<key>` and target agent `codex`
- AND `codex` is installed in `PATH` again
- WHEN `uninstall` is invoked again with the same key, action, and target
- THEN Quantex does not replay the stored uninstall success
- AND it executes the `codex` uninstall work

### Requirement: Timeout handling MUST preserve terminal failure codes

When a mutating command's primary work returns `ok: false` with a concrete error code, Quantex SHALL return that failure even if the timeout deadline has fired, unless the command was interrupted before producing a terminal result.

#### Scenario: Install failure after deadline is not reported as timeout

- GIVEN a mutating install command is invoked with `--timeout`
- AND the primary install work returns `ok: false` with error code `INSTALL_FAILED`
- AND the timeout deadline fires while the result is being finalized
- WHEN the runtime finalizes the command result
- THEN Quantex returns `INSTALL_FAILED`
- AND it does not substitute `TIMEOUT`

### Requirement: Idempotency filenames MUST be collision-safe for distinct client keys

Quantex SHALL map each distinct `--idempotency-key` value to a distinct on-disk record filename so sanitization cannot merge unrelated client keys.

#### Scenario: Distinct keys that previously sanitized to the same filename remain independent

- GIVEN a successful mutating command stored with idempotency key `job-1/install/codex`
- WHEN a different mutating command is invoked with idempotency key `job-1_install_codex`
- THEN Quantex does not replay the first command's stored result
- AND it executes the new command work independently

