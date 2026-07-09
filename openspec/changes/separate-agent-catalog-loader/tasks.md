## 1. Compatibility Baseline

- [x] 1.1 Run the existing agent catalog and generated-manifest tests.
- [x] 1.2 Confirm ordered definitions, canonical lookup, named-export identity, schema validation, and manifest sync coverage.

## 2. Loader TDD

- [x] 2.1 Add failing direct tests for valid loading, invalid data, unknown lookup, ordering, and behavior-extension merging.
- [x] 2.2 Verify failure because `src/agents/catalog-loader.ts` does not exist.
- [x] 2.3 Implement `loadAgentCatalog(data, behaviorExtensions)` with the existing schema.
- [x] 2.4 Verify focused loader tests pass.

## 3. Snapshot Adapter Migration

- [x] 3.1 Refactor `src/agents/catalog.ts` to bind generated `catalogData` through the loader once.
- [x] 3.2 Run focused loader and existing catalog compatibility tests.
- [x] 3.3 Confirm generated catalog files remain unchanged.

## 4. Validation

- [x] 4.1 Run lint, format check, typecheck, full tests, OpenSpec validation, memory check, and build.
- [x] 4.2 Review the diff and mark implementation tasks complete.
- [x] 4.3 Commit the completed loader extraction without creating a PR.
