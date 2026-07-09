## 1. Compatibility Baseline

- [x] 1.1 Strengthen `test/commands/uninstall.test.ts` structured assertions for unmanaged, dry-run, success, failure, and lock outcomes.
- [x] 1.2 Run the existing uninstall command tests before refactoring.

## 2. Service TDD

- [x] 2.1 Add failing `test/services/uninstall.test.ts` coverage for all service outcomes and unexpected error propagation.
- [x] 2.2 Verify the service test fails because `src/services/uninstall.ts` does not exist.
- [x] 2.3 Implement `runUninstallLifecycle(agentName, options, dependencies)` in `src/services/uninstall.ts`.
- [x] 2.4 Verify the focused service tests pass.

## 3. Command Migration

- [x] 3.1 Refactor `src/commands/uninstall.ts` to map service outcomes while preserving messages and rendering.
- [x] 3.2 Run focused service and command compatibility tests.
- [x] 3.3 Remove duplicate lifecycle imports and branches from the command.

## 4. Validation

- [x] 4.1 Run lint, format check, typecheck, the full test suite, OpenSpec validation, and memory check.
- [x] 4.2 Review the diff and mark all implementation tasks complete.
- [x] 4.3 Commit the completed uninstall extraction without creating a PR.
