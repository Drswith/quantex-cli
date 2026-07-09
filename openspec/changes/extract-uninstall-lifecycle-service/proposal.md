## Why

`uninstallCommand` currently owns agent resolution, managed-state checks, dry-run policy, package-manager execution, and lifecycle lock classification in addition to public result mapping. Extracting those command-neutral decisions continues the approved compatibility-preserving lifecycle boundary without changing uninstall behavior.

## What Changes

- Add a focused uninstall lifecycle service for resolution, ownership checks, dry-run decisions, execution, and lock classification.
- Keep action names, error and warning messages, result shapes, exit behavior, and human rendering in `uninstallCommand`.
- Add direct service tests and strengthen command compatibility assertions.
- Preserve the existing state format, package-manager uninstall behavior, unmanaged-install refusal, dry-run semantics, and lifecycle lock scope.
- Make no breaking changes.

## Capabilities

### New Capabilities

- `uninstall-lifecycle-service`: Defines the internal uninstall lifecycle boundary and its observable compatibility requirements.

### Modified Capabilities

None.

## Impact

- Code: `src/commands/uninstall.ts` and a new `src/services/uninstall.ts`.
- Tests: `test/commands/uninstall.test.ts` and a new focused service test.
- No changes to public commands, schemas, configuration, state, catalog, installer adapters, or release behavior.
