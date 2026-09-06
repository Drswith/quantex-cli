## 1. Core-internal leaf

- [x] 1.1 Add `src/core/lifecycle/model.ts` with the current receipt/observation types and `LIFECYCLE_RECEIPT_SCHEMA_VERSION` (`as const`), as a zero-import leaf
- [x] 1.2 Point remaining `src/lifecycle/*` modules and the barrel at the Core-internal leaf
- [x] 1.3 Delete `src/lifecycle/model.ts` (no compatibility shim)

## 2. Importer retarget

- [x] 2.1 Update Core `installation-*` / `uninstall-executor` / other `../lifecycle/model` imports to `./lifecycle/model`
- [x] 2.2 Update `src/state/{schema,store,index}` to import the leaf only; re-export the receipt schema constant from the leaf
- [x] 2.3 Update `src/package-manager` and tests that imported `src/lifecycle/model`
- [x] 2.4 Split Core barrel imports so model types/constants come from the leaf while L2+ engines stay on `src/lifecycle`

## 3. Ownership lock and memory

- [x] 3.1 Update `test/core/lifecycle-core-ownership.test.ts` for the L1 graph (leaf present, `src/lifecycle/model.ts` absent, state leaf-only, SDK non-export)
- [x] 3.2 Add ADR 0011 recording the leaf-vs-runtime distinction
- [x] 3.3 Add a thin AGENTS.md pointer to `src/core/lifecycle/` and `runtime-boundaries`

## 4. Validation and delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`
- [x] 4.2 Run `bun run test`
- [x] 4.3 Run `bun run openspec:validate` and `bun run memory:check`
- [x] 4.4 Commit, push, and open a **draft** PR with before/after import map, SDK non-export checklist, freeze checklist, and internal changelog framing
