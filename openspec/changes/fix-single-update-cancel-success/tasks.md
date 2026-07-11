## 1. Implementation

- [x] 1.1 Add a post-execution `getCliContext().cancelled` fail-closed guard to `updateSingleAgent` mirroring `updateAllAgents`
- [x] 1.2 Add a regression test that cancels during single-agent update and asserts `ok: false` with `CANCELLED`

## 2. Validation

- [x] 2.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 2.2 Run `bun run openspec:validate`
