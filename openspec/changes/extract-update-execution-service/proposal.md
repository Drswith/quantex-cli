## Why

Update planning already lives in `src/services/update.ts`, but `updateCommand` still owns grouped execution, fallback behavior, cancellation, dry-run handling, lifecycle lock classification, self-update verification, and progress emission. Extracting command-neutral execution completes the update lifecycle boundary while preserving the published CLI contract.

## What Changes

- Add a focused update execution service that consumes the existing update plan.
- Pass dry-run, cancellation, and progress reporting through explicit service options.
- Keep action names, structured results, error mapping, NDJSON event construction, and human rendering in `updateCommand`.
- Add direct service tests and retain the existing command compatibility coverage.
- Preserve grouped installer order, per-agent fallback, self-update version verification, lifecycle lock details, and cancellation behavior.
- Make no breaking changes.

## Capabilities

### New Capabilities

- `update-execution-service`: Defines the internal update execution boundary and its observable compatibility requirements.

### Modified Capabilities

None.

## Impact

- Code: `src/commands/update.ts` and a new `src/services/update-execution.ts`.
- Tests: `test/commands/update.test.ts` and a new focused service test.
- No changes to public commands, schemas, configuration, state, catalog, update planning, installer adapters, or release behavior.
