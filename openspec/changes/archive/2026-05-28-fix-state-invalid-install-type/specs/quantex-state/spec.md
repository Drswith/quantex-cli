## MODIFIED Requirements

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
- **WHEN** Quantex loads persisted state for inspection or mutation
- **THEN** the operation fails with a state read error
- **AND** Quantex does not crash while resolving installer capabilities
