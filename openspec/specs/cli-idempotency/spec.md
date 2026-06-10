# cli-idempotency Specification

## Purpose

Define when Quantex mutating commands persist and replay idempotency records for client-supplied retry keys.

## Requirements

### Requirement: Idempotency MUST replay only successful completions

Mutating commands that accept `--idempotency-key` SHALL persist idempotency records only when the primary command result is successful (`ok: true`).

#### Scenario: Successful mutating command is replayed

- GIVEN a mutating command completes with `ok: true`
- AND the caller supplied `--idempotency-key <key>`
- WHEN the same command is invoked again with the same key and action before the record expires
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

### Requirement: Idempotency filenames MUST be collision-safe for distinct client keys

Quantex SHALL map each distinct `--idempotency-key` value to a distinct on-disk record filename so sanitization cannot merge unrelated client keys.

#### Scenario: Distinct keys that previously sanitized to the same filename remain independent

- GIVEN a successful mutating command stored with idempotency key `job-1/install/codex`
- WHEN a different mutating command is invoked with idempotency key `job-1_install_codex`
- THEN Quantex does not replay the first command's stored result
- AND it executes the new command work independently
