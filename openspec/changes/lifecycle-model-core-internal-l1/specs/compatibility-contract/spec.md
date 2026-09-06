## ADDED Requirements

### Requirement: Internalizing lifecycle model types MUST NOT drift frozen v1 contracts

Moving lifecycle receipt and observation TypeScript types into a Core-internal module MUST NOT change persisted state schema version 2, the lifecycle receipt JSON shape, maintained command aliases, exit-code classes, or v1 `--json` / NDJSON envelopes. Structured output MUST still omit engine and route identifiers. The published `quantex-core` root MUST NOT gain lifecycle-model exports as part of this internalization.

#### Scenario: State v2 and receipt JSON stay byte-compatible

- **GIVEN** a valid schema version 2 `state.json` with lifecycle receipts
- **WHEN** Quantex loads or records receipts after the model move
- **THEN** the schema version remains `2`
- **AND THEN** receipt field names, requiredness, and meanings are unchanged

#### Scenario: Structured CLI output omits engine and route

- **WHEN** a maintained lifecycle command emits JSON or NDJSON after the model move
- **THEN** the payload does not include selected engine or route identifiers
- **AND THEN** aliases and exit-code classes remain the pre-move v1 contract

#### Scenario: Published SDK export list is unchanged

- **WHEN** a TypeScript consumer imports `quantex-core` or `src/core/index.ts`
- **THEN** the runtime export remains `createQuantex`
- **AND THEN** lifecycle receipt types are not added to that public surface
