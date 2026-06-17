## 1. Implementation

- [x] 1.1 Defer exec install cancellation until after late-success grace in `src/commands/run.ts`
- [x] 1.2 Preserve terminal failure results in `runUntilTimeoutCancellation`
- [x] 1.3 Add regression tests for cancellation-aware late success and failure-code preservation

## 2. Validation

- [x] 2.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
