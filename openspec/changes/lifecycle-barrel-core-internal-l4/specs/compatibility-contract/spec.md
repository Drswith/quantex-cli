## ADDED Requirements

### Requirement: Deleting the leftover lifecycle barrel MUST NOT drift frozen v1 contracts

Retargeting remaining `src/lifecycle` imports onto Core-internal modules and deleting that directory MUST NOT change persisted state schema version 2, the lifecycle receipt JSON shape, maintained command aliases, exit-code classes, or v1 `--json` / NDJSON envelopes. Structured output MUST still omit engine and route identifiers. The published `quantex-core` root MUST NOT gain lifecycle helper exports as part of this deletion.

#### Scenario: State v2 and receipt JSON stay byte-compatible

- **GIVEN** a valid schema version 2 `state.json` with lifecycle receipts
- **WHEN** Quantex loads or records receipts after the barrel deletion
- **THEN** the schema version remains `2`
- **AND THEN** receipt field names, requiredness, and meanings are unchanged

#### Scenario: Structured CLI output omits engine and route

- **WHEN** a maintained lifecycle command emits JSON or NDJSON after the barrel deletion
- **THEN** the payload does not include selected engine or route identifiers
- **AND THEN** aliases and exit-code classes remain the pre-deletion v1 contract

#### Scenario: Published SDK export list is unchanged

- **WHEN** a TypeScript consumer imports `quantex-core` or `src/core/index.ts`
- **THEN** the runtime export remains `createQuantex`
- **AND THEN** lifecycle barrel symbols are not added to that public surface
