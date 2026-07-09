## 1. Compatibility Baseline

- [x] 1.1 Run the existing command-runtime and state-read compatibility tests.
- [x] 1.2 Confirm coverage for timeout, late completion, signal cancellation, idempotency, output, and passive notices.

## 2. Cancellation Service TDD

- [x] 2.1 Add failing tests for completion, timeout grace, cancellation cleanup, process signals, listener cleanup, and error propagation.
- [x] 2.2 Verify failure because `src/services/runtime-cancellation.ts` does not exist.
- [x] 2.3 Implement command-neutral cancellation outcomes with explicit dependencies.
- [x] 2.4 Verify focused cancellation tests pass.

## 3. Idempotency Service TDD

- [x] 3.1 Add failing tests for miss, conflict, target mismatch, dry-run exclusion, lifecycle validity, replay metadata, and persistence eligibility.
- [x] 3.2 Verify failure because `src/services/runtime-idempotency.ts` does not exist.
- [x] 3.3 Implement command-neutral idempotency outcomes with explicit dependencies.
- [x] 3.4 Verify focused idempotency tests pass.

## 4. Runtime Facade Migration

- [x] 4.1 Refactor `src/command-runtime.ts` to compose both services and own public output mapping.
- [x] 4.2 Run focused service and existing facade compatibility tests.
- [x] 4.3 Remove duplicate timeout, signal, and idempotency policy from the facade.

## 5. Validation

- [x] 5.1 Run lint, format check, typecheck, full tests, OpenSpec validation, and memory check.
- [x] 5.2 Review the diff and mark implementation tasks complete.
- [x] 5.3 Commit the completed runtime extraction without creating a PR.
