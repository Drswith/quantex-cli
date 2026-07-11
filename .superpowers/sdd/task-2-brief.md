# Task 2 Brief: Reusable Provider Conformance Harness

## Objective

Create one reusable Vitest contract that later provider adapter tests can invoke with injected deterministic cases. This task establishes the harness and proves it against a fixture adapter; it does not claim real-provider conformance yet.

## Required cases

- Unsupported optional operation is absent from derived capabilities and maps to a typed `unsupported` outcome.
- Failure preserves reason, command, exit code, retryability, remediation, and evidence.
- An already-aborted operation returns `cancelled`, not generic failure.
- Provider timeout returns `timed-out` with the effective timeout.
- Observation distinguishes typed present and absent results; present evidence includes version/provider detail.
- Provider unavailability remains distinct from command failure.
- Successful verification is satisfied and carries non-empty provider-specific evidence.

## Boundary

- Keep the reusable harness in `test/providers/conformance.ts`.
- Use a fresh subject per test so cancellation or mutable fixtures cannot leak between adapters.
- Do not mark OpenSpec `4.2` complete until every real first-party adapter is migrated and invokes this harness; this checkpoint only makes later group completion mechanically enforceable.

## TDD loop

1. Add a fixture test importing the not-yet-created conformance helper and confirm module failure.
2. Implement the smallest reusable helper that asserts the required cases.
3. Run focused tests and static checks.
4. Request a narrow independent review, write the task report, and create a checkpoint commit while leaving `4.2` unchecked.
