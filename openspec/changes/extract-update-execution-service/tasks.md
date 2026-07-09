## 1. Compatibility Baseline

- [x] 1.1 Confirm the existing update command tests cover structured success, failure, dry-run, cancellation, lock, fallback, and self-update outcomes.
- [x] 1.2 Run the existing update command tests before refactoring.

## 2. Service TDD

- [x] 2.1 Add failing `test/services/update-execution.test.ts` coverage for ordered classifications, grouped success and fallback, dry-run, cancellation, lock, and self-update verification.
- [x] 2.2 Verify the service test fails because `src/services/update-execution.ts` does not exist.
- [x] 2.3 Implement `executePlannedUpdates(plan, options, dependencies)` in `src/services/update-execution.ts`.
- [x] 2.4 Verify the focused service tests pass.

## 3. Command Migration

- [x] 3.1 Refactor `src/commands/update.ts` to map service progress and terminal state while preserving messages and rendering.
- [x] 3.2 Run focused service and command compatibility tests.
- [x] 3.3 Remove duplicate execution imports, types, and functions from the command.

## 4. Validation

- [x] 4.1 Run lint, format check, typecheck, the full test suite, OpenSpec validation, and memory check.
- [x] 4.2 Review the diff and mark all implementation tasks complete.
- [x] 4.3 Commit the completed update extraction without creating a PR.
