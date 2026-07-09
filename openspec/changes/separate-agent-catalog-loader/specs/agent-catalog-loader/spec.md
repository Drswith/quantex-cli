## ADDED Requirements

### Requirement: Catalog loader extraction MUST preserve the runtime catalog

Quantex MUST preserve catalog schema validation, entry ordering, runtime definitions, canonical lookup, generated named exports, and object identity while separating catalog loading from the checked-in generated snapshot.

#### Scenario: Generated snapshot loads unchanged

- **WHEN** Quantex initializes the checked-in generated catalog snapshot
- **THEN** the loader returns the same ordered agent definitions and canonical lookups as before

#### Scenario: Named exports retain identity

- **WHEN** a caller imports a generated named agent export
- **THEN** it references the same runtime object returned by catalog lookup and the full agent list

#### Scenario: Invalid data is rejected

- **WHEN** supplied catalog data violates the existing agent catalog schema
- **THEN** the loader rejects it before creating runtime definitions

#### Scenario: Runtime behavior extensions remain data-independent

- **WHEN** a catalog entry receives a runtime-only behavior extension
- **THEN** the loader merges that behavior without changing the serializable catalog snapshot

### Requirement: Snapshot adapter MUST remain static

The production catalog adapter MUST bind the checked-in generated snapshot once and MUST NOT introduce external, remote, mutable, or user-provided runtime catalog loading.

#### Scenario: Production initialization

- **WHEN** the agents module initializes
- **THEN** it loads only the checked-in generated catalog snapshot through the pure loader
