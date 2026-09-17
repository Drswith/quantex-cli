## MODIFIED Requirements

### Requirement: Physical Core source separation MUST NOT drift frozen v1 contracts

Moving Core implementation from root `src/core` into `packages/core/src`, relocating package-manager from `src/package-manager` into `packages/core/src/package-manager`, relocating providers from `src/providers` into `packages/core/src/providers`, and relocating state from `src/state/` into `packages/core/src/state`, MUST NOT change persisted state schema version 2, the lifecycle receipt JSON shape, maintained command aliases, exit-code classes, or v1 `--json` / NDJSON envelopes. Structured output MUST still omit engine and route identifiers. The published `quantex-core` root MUST NOT gain new methods, lifecycle-model exports, package-manager exports, provider exports, state exports, or package subpaths as part of this relocation.

#### Scenario: State v2 and receipt JSON stay byte-compatible

- **GIVEN** a valid schema version 2 `state.json` with lifecycle receipts
- **WHEN** Quantex loads or records receipts after the physical Core source move, package-manager relocation, providers relocation, or state relocation
- **THEN** the schema version remains `2`
- **AND THEN** receipt field names, requiredness, and meanings are unchanged

#### Scenario: Structured CLI output omits engine and route

- **WHEN** a maintained lifecycle command emits JSON or NDJSON after the physical Core source move, package-manager relocation, providers relocation, or state relocation
- **THEN** the payload does not include selected engine or route identifiers
- **AND THEN** aliases and exit-code classes remain the pre-move v1 contract

#### Scenario: Published SDK export list is unchanged

- **WHEN** a TypeScript consumer imports `quantex-core`
- **THEN** the runtime export remains `createQuantex`
- **AND THEN** `packages/core/package.json` still exports only `.` and `./package.json`
- **AND THEN** lifecycle engines, receipts, package-manager, providers, state, and route identifiers are not added to that public surface

#### Scenario: CLI packaged declaration snapshot retargets relocated Core paths

- **WHEN** the CLI package `dist/index.d.mts` is rebuilt after package-manager, providers, or state move under `packages/core/src`
- **THEN** the pinned v1 declaration snapshot may retarget `#region` source paths for those files
- **AND THEN** `ManagedInstallerUpdateOptions.npmBunUpdateStrategy` may name the equivalent Core-owned `RegistryPackageUpdateStrategy` union instead of the CLI config alias
- **AND THEN** `SelfInstallSource` may resolve through the Core-owned state schema while keeping the same `'binary' | 'bun' | 'npm' | 'source' | 'unknown'` union
- **AND THEN** the snapshot MUST NOT add new exported values, package-manager, providers, or state as a public SDK method, or engine/route identifiers
