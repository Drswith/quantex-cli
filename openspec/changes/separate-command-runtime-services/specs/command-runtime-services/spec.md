## ADDED Requirements

### Requirement: Runtime service extraction MUST preserve command behavior

Quantex MUST preserve timeout, process-signal cancellation, idempotency replay, state-read failure, output, finalization, and passive self-update notice behavior while moving command-neutral runtime policies behind service boundaries.

#### Scenario: Deadline preserves late terminal completion

- **WHEN** the timeout deadline fires and primary work returns a terminal result within the existing grace period
- **THEN** Quantex returns that terminal result
- **AND** does not emit a timeout cancellation

#### Scenario: Deadline cancellation remains structured

- **WHEN** primary work does not complete within the deadline and grace period
- **THEN** Quantex cancels registered operations
- **AND** emits the existing cancelled event and `TIMEOUT` result

#### Scenario: Process signal cancellation remains structured

- **WHEN** the process receives `SIGINT` or `SIGTERM` during primary work
- **THEN** Quantex cancels registered operations
- **AND** emits the existing cancelled event and `CANCELLED` result

#### Scenario: Idempotency behavior remains unchanged

- **WHEN** an invocation supplies an idempotency key
- **THEN** Quantex preserves existing conflict, target matching, dry-run exclusion, lifecycle validity, metadata refresh, and successful-result persistence rules

#### Scenario: Runtime errors retain public mapping

- **WHEN** the runtime encounters a state-read error, timeout, signal cancellation, idempotency conflict, or replay
- **THEN** Quantex preserves the existing action, target, error details, result metadata, events, and human rendering

### Requirement: Runtime services MUST remain output-neutral

Cancellation and idempotency services MUST return command-neutral outcomes and MUST NOT emit `CommandResult`, NDJSON, or human output directly.

#### Scenario: Facade maps service outcome

- **WHEN** a runtime service returns an execution outcome
- **THEN** `executeCommandWithRuntime` constructs and emits the existing public output exactly once
