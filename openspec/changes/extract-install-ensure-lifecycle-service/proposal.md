## Why

`install` and `ensure` currently duplicate the same single-agent inspection, existing-install adoption, dry-run, installation, cancellation, lock-error, and state-result decisions inside separate command handlers. Quantex already has active users, so the first refactor slice must reduce that duplication behind a shared lifecycle boundary while preserving the published CLI and machine-readable contracts.

## What Changes

- Add compatibility-focused tests that lock the current single-agent `install` and `ensure` results for unknown agents, managed and unmanaged existing installs, dry runs, successful installs, failed installs, cancellation, and lifecycle lock failures.
- Introduce a shared install/ensure lifecycle service that owns command-neutral inspection, adoption, dry-run, and installation decisions.
- Keep command handlers responsible for action names, command-specific messages, structured result mapping, event emission, batch aggregation, and human rendering.
- Preserve existing command names, flags, aliases, JSON/NDJSON shapes, warning and error codes, exit behavior, install-source selection, persisted state format, and cancellation semantics.
- Keep batch install behavior, installer adapter interfaces, lifecycle lock scope, `update`, `uninstall`, `exec`, self-upgrade, and catalog loading outside this first refactor slice.
- Make no breaking changes.

## Capabilities

### New Capabilities

- `install-ensure-lifecycle-service`: Defines the shared internal lifecycle boundary and the observable compatibility requirements for single-agent `install` and `ensure`.

### Modified Capabilities

None.

## Impact

- Primary code: `src/commands/install.ts`, `src/commands/ensure.ts`, and a new focused module under `src/services/`.
- Existing dependencies: agent inspection, install-method adoption, package-manager installation/tracking, CLI cancellation context, dry-run context, lifecycle lock errors, output result builders, and state persistence.
- Tests: `test/commands/install.test.ts`, `test/commands/ensure.test.ts`, plus focused service tests.
- Public APIs, package dependencies, configuration, persisted state, catalog data, release artifacts, and runtime requirements remain unchanged.
