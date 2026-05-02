# CLI Command Runtime Specification (delta)

## Purpose

Document observable finalization behavior when a command is cancelled by timeout or process signal.

## ADDED Requirements

### Requirement: Late command completion MUST NOT apply post-success finalization after timeout or cancellation

When the shared command runtime has already returned a timeout or cancellation result to the caller, Quantex SHALL NOT treat a later settlement of the same command invocation as grounds for persisting idempotency records or running other post-success finalization that is tied to successful command completion.

#### Scenario: Command times out then succeeds asynchronously

- GIVEN a command runs with a configured timeout
- AND the runtime returns a timeout error to the caller first
- WHEN the underlying command promise later resolves successfully
- THEN Quantex does not persist an idempotency success record for that invocation based on the late resolution
- AND Quantex does not run post-success side effects that are only appropriate after a successful command completion

#### Scenario: Command receives termination signal then succeeds asynchronously

- GIVEN a command runs under signal-aware cancellation
- AND the runtime returns a cancellation error to the caller first
- WHEN the underlying command promise later resolves successfully
- THEN Quantex does not persist an idempotency success record for that invocation based on the late resolution
