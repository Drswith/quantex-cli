## 1. Contract and Regression Coverage

- [x] 1.1 Add lifecycle service tests for catalog-only absence, recorded-absent state, tracked self-update success/no-change/failure, and untracked PATH preservation.
- [x] 1.2 Add command tests proving consistent single/batch projection and non-fatal stale-state guidance.

## 2. Lifecycle Update Implementation

- [x] 2.1 Filter batch targets from executable and persisted lifecycle evidence rather than provider drift.
- [x] 2.2 Add a typed self-update plan and executor with fresh version/source verification and receipt persistence.
- [x] 2.3 Project stale and blocked outcomes consistently in single and batch command modes.

## 3. Validation and Delivery

- [x] 3.1 Run focused tests, lint, format check, typecheck, full tests, OpenSpec validation, and memory validation.
- [x] 3.2 Reproduce the corrected local `update --all` and Cursor dry-run behavior from the source CLI.
- [x] 3.3 Commit the intended files, push the branch, validate the PR body, open the PR, and verify remote checks/state.
