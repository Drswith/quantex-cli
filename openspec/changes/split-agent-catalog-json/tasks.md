## 1. OpenSpec

- [x] Create OpenSpec change for per-agent catalog JSON files.
- [x] Define catalog layout and generated manifest contract.

## 2. Implementation

- [x] Split `src/agents/catalog-data.json` into `src/agents/catalog/*.json`.
- [x] Add a manifest generator based on `node:fs/promises.readdir()`.
- [x] Check in the generated TypeScript manifest outside the catalog JSON directory.
- [x] Update the catalog adapter to load catalog data from the generated manifest.
- [x] Remove `src/agents/definitions/*.ts` compatibility files.
- [x] Preserve named agent exports from `src/agents`.
- [x] Update docs that describe the catalog source of truth.

## 3. Tests

- [x] Cover checked-in manifest drift.
- [x] Cover filename/name mismatch rejection.
- [x] Cover valid catalog loading and lookup/export compatibility.

## 4. Validation

- [x] Run `bun run lint`.
- [x] Run `bun run format:check`.
- [x] Run `bun run typecheck`.
- [x] Run `bun run test`.
- [x] Run `bun run openspec:validate`.
