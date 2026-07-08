## 1. Implementation

- [x] 1.1 Return `CANCELLED` from batch `installCommand()` when `getCliContext().cancelled` is true before every requested agent is processed
- [x] 1.2 Add regression test for batch install stopping after cancellation without overall success
- [x] 1.3 Add regression test for timeout-wrapped batch install not reporting overall success on partial completion

## 2. Validation

- [x] 2.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
