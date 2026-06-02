## MODIFIED Requirements

### Requirement: Corrupt or unreadable state file MUST fail closed

When `state.json` exists but cannot be read, parsed, or normalized into a safe persisted state shape, Quantex MUST NOT substitute empty default state for a subsequent write.

#### Scenario: Managed installed agent with empty packageName is rejected

- **GIVEN** `state.json` exists with a managed `installType` for an installed agent
- **AND** the entry sets `packageName` to an empty string
- **WHEN** Quantex loads persisted state for inspection or mutation
- **THEN** the operation fails with a state read error
