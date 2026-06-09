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
