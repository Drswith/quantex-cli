## 1. Existing Install Reconciliation

- [x] 1.1 Add a safe adoption path that records an existing untracked install when the current platform exposes exactly one unmanaged install method.
- [x] 1.2 Update `install` and `ensure` output so adopted installs and still-untracked installs are distinguished clearly.

## 2. Regression Coverage

- [x] 2.1 Add command tests for adopting an existing script install and for leaving ambiguous existing installs untracked.
- [x] 2.2 Add update regression coverage proving a tracked script install participates in `quantex update --all`.

## 3. Validation

- [x] 3.1 Run `bun run openspec:validate`.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
