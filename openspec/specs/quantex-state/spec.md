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

When `state.json` exists but cannot be read or parsed, Quantex MUST NOT substitute empty default state for a subsequent write.

#### Scenario: Invalid JSON must not be wiped by a later mutation

- **GIVEN** `state.json` exists with previously recorded `installedAgents` or `self` data
- **AND** the file contents are not valid JSON
- **WHEN** Quantex attempts a state mutation
- **THEN** the operation fails with a state read error
- **AND** Quantex does not overwrite the file with empty default state

### Requirement: State writes MUST be atomic

Quantex SHALL write `state.json` through a temporary file and atomic rename so interrupted writes do not leave torn JSON as the primary state file.

#### Scenario: Interrupted write does not replace valid state with torn JSON

- **GIVEN** a valid `state.json` already exists
- **WHEN** Quantex writes updated state
- **THEN** it writes complete JSON to a temporary path first
- **AND** it replaces `state.json` only via rename of the completed temporary file
