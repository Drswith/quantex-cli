# quantex-state Specification

## Purpose

Define the observable safety contract for Quantex persisted state loading, mutation, and writes.
## Requirements
### Requirement: Missing state file MUST initialize as empty state

When `state.json` does not exist, Quantex SHALL treat persisted state as empty without reporting a fatal state error.

#### Scenario: First run without state file

- **GIVEN** no `state.json` exists under the Quantex config directory
- **WHEN** Quantex loads or mutates persisted state
- **THEN** it uses an empty default state
- **AND** it may create `state.json` on the first successful write

### Requirement: Corrupt or unreadable state file MUST fail closed

When `state.json` exists but cannot be read, parsed, or normalized into a safe persisted state shape, Quantex MUST NOT substitute empty default state for a subsequent write.

#### Scenario: Invalid JSON must not be wiped by a later mutation

- **GIVEN** `state.json` exists with previously recorded `installedAgents` or `self` data
- **AND** the file contents are not valid JSON
- **WHEN** Quantex attempts a state mutation
- **THEN** the operation fails with a state read error
- **AND** Quantex does not overwrite the file with empty default state

#### Scenario: Invalid installed agent records must not crash lifecycle commands

- **GIVEN** `state.json` exists with an `installedAgents` entry that uses an unknown `installType`
- **WHEN** Quantex loads persisted state for inspection or mutation through a CLI command
- **THEN** the operation fails with a state read error
- **AND** Quantex does not crash while resolving installer capabilities
- **AND** structured output mode returns `{ ok: false, error: { code: "STATE_READ_ERROR", ... } }`

#### Scenario: Non-object JSON root must not be treated as empty state

- **GIVEN** `state.json` exists with valid JSON whose root value is not an object (for example `[]`, `null`, or a primitive)
- **WHEN** Quantex loads persisted state for inspection or mutation
- **THEN** the operation fails with a state read error
- **AND** Quantex does not overwrite the file with empty default state on a later mutation

#### Scenario: Managed installed agent with empty packageName is rejected

- **GIVEN** `state.json` exists with a managed `installType` for an installed agent
- **AND** the entry sets `packageName` to an empty string
- **WHEN** Quantex loads persisted state for inspection or mutation
- **THEN** the operation fails with a state read error

#### Scenario: Invalid JSON must not crash lifecycle commands

- **GIVEN** `state.json` exists with previously recorded `installedAgents` or `self` data
- **AND** the file contents are not valid JSON
- **WHEN** Quantex runs a lifecycle command that loads persisted state
- **THEN** the operation fails with a state read error
- **AND** Quantex does not emit an unhandled exception stack trace to the user

### Requirement: State writes MUST be atomic

Quantex SHALL write `state.json` through a temporary file and atomic rename so interrupted writes do not leave torn JSON as the primary state file.

#### Scenario: Interrupted write does not replace valid state with torn JSON

- **GIVEN** a valid `state.json` already exists
- **WHEN** Quantex writes updated state
- **THEN** it writes complete JSON to a temporary path first
- **AND** it replaces `state.json` only via rename of the completed temporary file

### Requirement: Lifecycle state MUST be schema-versioned management evidence

Quantex MUST associate persisted lifecycle state with an explicit schema version and MUST treat installed-agent records and lifecycle receipts as evidence of prior Quantex management activity rather than authoritative proof of the current environment.

#### Scenario: Loading versioned lifecycle evidence

- **GIVEN** persisted state uses a supported schema version and contains a lifecycle receipt for an agent
- **WHEN** Quantex loads the state for a lifecycle command
- **THEN** Quantex interprets the record according to its declared schema version
- **AND** it treats the receipt as management history that can inform lifecycle planning
- **AND** it does not treat the receipt alone as proof of the agent's current installation state

### Requirement: Lifecycle receipts MUST be reconciled with live observations

Before using a persisted lifecycle receipt to plan or report an agent mutation, Quantex MUST reconcile that receipt with a current observation of the live environment and MUST represent detected drift instead of silently preferring persisted state.

#### Scenario: Live environment disagrees with a recorded receipt

- **GIVEN** persisted state records that an agent was installed through a managed provider
- **AND** current provider and executable observations show that the recorded installation is absent or has changed
- **WHEN** Quantex inspects or plans a lifecycle operation for that agent
- **THEN** Quantex bases the current lifecycle decision on the live observation
- **AND** it retains the receipt only as management provenance or recovery evidence
- **AND** it does not report the recorded installation as current solely because it exists in persisted state

### Requirement: Legacy lifecycle state migration MUST be atomic and fail closed

Quantex MUST continue to read every supported older state schema, MUST preserve recognized management evidence while migrating it to the current schema, and MUST commit a migration only after the complete migrated state has been validated and can atomically replace the original state.

#### Scenario: Supported legacy state is migrated without losing evidence

- **GIVEN** `state.json` contains valid lifecycle state in a supported older schema
- **WHEN** Quantex loads the state and persists it in the current schema
- **THEN** Quantex preserves all recognized installed-agent records, lifecycle receipts, and self state
- **AND** it writes the fully validated current-schema state through atomic replacement

#### Scenario: Failed migration leaves legacy state intact

- **GIVEN** `state.json` contains state that requires migration
- **WHEN** Quantex cannot fully normalize, validate, or atomically persist the migrated state
- **THEN** Quantex fails the state operation with a state read or write error
- **AND** it does not use or persist a partially migrated state
- **AND** the original `state.json` remains unchanged and available for a later compatible reader or retry
