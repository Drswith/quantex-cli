## 1. OpenSpec

- [x] Create OpenSpec change for issue #240.
- [x] Define the catalog data/schema migration contract.

## 2. Implementation

- [x] Add a JSON-compatible supported-agent catalog data source.
- [x] Add Zod schemas for catalog entries, install methods, update metadata, and version probes.
- [x] Add a catalog adapter that validates data before returning runtime `AgentDefinition` values.
- [x] Emit and check in JSON Schema from the Zod contract.
- [x] Preserve existing individual agent definition exports through thin compatibility modules.
- [x] Update docs that describe the supported-agent source of truth.

## 3. Tests

- [x] Cover valid catalog loading and lookup compatibility.
- [x] Cover invalid catalog rejection.
- [x] Cover checked-in JSON Schema drift.

## 4. Validation

- [x] Run `bun run lint`.
- [x] Run `bun run format:check`.
- [x] Run `bun run typecheck`.
- [x] Run `bun run test`.
- [x] Run `bun run openspec:validate`.
