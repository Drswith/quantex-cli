## 1. Implementation

- [x] 1.1 Register an AbortController with `registerCliCancellationHandler` inside `upgradeStandaloneBinary`
- [x] 1.2 Pass the abort signal to `fetch` and unregister the handler after download/body read settles
- [x] 1.3 Map abort failures onto the existing binary network failure path

## 2. Tests

- [x] 2.1 Add regression coverage that CLI cancellation aborts an in-flight binary download fetch
- [x] 2.2 Keep existing checksum/Windows swap coverage green

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 3.2 Run `bun run openspec:validate`
