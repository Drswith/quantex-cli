# Task 1 Brief: Typed Provider Contracts And Registry

## Objective

Implement the smallest compile-time provider boundary that fully expresses OpenSpec task `4.1` without rerouting legacy command behavior.

## Required behavior

- Stable first-party provider IDs are unique and exhaustively typed.
- Registry lookup/list APIs are read-only and offer no dynamic registration mutation.
- An adapter exposes typed availability and observation operations plus optional typed install, update, uninstall, latest-version, batch-update, and verification operations.
- Capabilities are derived solely from operation presence.
- Outcomes distinguish success, unsupported, unavailable, failed, cancelled, timed out, and indeterminate states.
- Provider failures can preserve argv, exit status, retryability, and safe remediation/evidence.
- Operation context carries `AbortSignal` and optional timeout without importing CLI state.

## Compatibility boundary

- Do not change `AgentDefinition`, catalog JSON, public root exports, command handlers, or current installer behavior in this task.
- Do not replace `INSTALLER_CAPABILITIES` yet; that happens only after all adapters exist.
- Do not mark OpenSpec `4.1` complete until tests and the exact contract categories above pass.

## TDD loop

1. Create `test/providers/registry.test.ts` importing modules that do not yet exist.
2. Run the focused test and record the expected module/contract failure.
3. Add minimal provider types and a compile-time registry implementation.
4. Re-run focused tests, lint, format check, and typecheck.
5. Write `task-1-report.md`, update progress, update OpenSpec only if literally complete, and create the checkpoint commit.
