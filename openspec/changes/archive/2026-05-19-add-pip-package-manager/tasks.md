## 1. Core Implementation

- [x] 1.1 Add pip to managed install types, package metadata, install-method helpers, and installer capability classification.
- [x] 1.2 Add pip availability detection and pip installer implementation.
- [x] 1.3 Wire pip into managed installer lookup, install/update/uninstall execution, and batch update grouping (including `planAgentUpdates` grouped installer order so `--all` executes pip buckets).
- [x] 1.4 Render pip install commands and expose pip availability in `capabilities` and `doctor`.

## 2. Agent Migration

- [x] 2.1 Migrate Mistral Vibe agent definition from `binaryInstall('pip install mistral-vibe')` to managed `pipInstall('mistral-vibe')`.

## 3. Tests

- [x] 3.1 Add or update unit coverage for pip installer behavior, command rendering, update planning, and diagnostics.

## 4. Validation

- [x] 4.1 Run `bun run openspec:status -- --change add-pip-package-manager`.
- [x] 4.2 Run `bun run openspec:validate`.
- [x] 4.3 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
