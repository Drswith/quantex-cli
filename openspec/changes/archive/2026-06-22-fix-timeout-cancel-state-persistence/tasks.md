## 1. Implementation

- [x] 1.1 Guard `persistInstalledState()` and managed install/update call sites against cancelled CLI context.
- [x] 1.2 Roll back managed installs when persistence is skipped due to cancellation.
- [x] 1.3 Add regression tests for cancelled persistence race in package manager and exec timeout paths.

## 2. Validation

- [x] 2.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
