## ADDED Requirements

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
