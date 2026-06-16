## 1. Implementation

- [x] 1.1 Defer timeout cancellation emission until after the late-success grace window in `src/command-runtime.ts`
- [x] 1.2 Add regression tests for stdout, exit code, and result consistency on late-success timeout paths

## 2. Validation

- [x] 2.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 2.2 Run `bun run openspec:validate`
