## 1. Implementation

- [x] 1.1 Return `CANCELLED` from `updateAllAgents()` when `getCliContext().cancelled` is true after `executePlannedUpdates()`
- [x] 1.2 Add regression test for batch update stopping after cancellation without overall success
- [x] 1.3 Add regression test for timeout-wrapped `update --all` not reporting overall success on partial completion

## 2. Validation

- [x] 2.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
