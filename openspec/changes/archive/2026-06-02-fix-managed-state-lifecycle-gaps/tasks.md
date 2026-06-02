## 1. Implementation

- [x] 1.1 Resolve managed package names during installed-state execution and block invalid self-update fallback
- [x] 1.2 Reject empty managed `packageName` values on state read
- [x] 1.3 Roll back managed installs when state persistence fails after install

## 2. Validation

- [x] 2.1 Add regression tests for update fallback, state read, and install rollback
- [x] 2.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
