## Why

Work-intake classification: `quantex upgrade` observable behavior must stay correct when registry/version resolution fails.

A regression after semantic version comparison treats “no resolved latest version” the same as “installed version is already newest”, suppressing `check-unavailable` / `--check` failure paths and misreporting connectivity issues as up to date.

## What Changes

- Treat “resolved latest version missing” separately from “latest is not newer than current” for the early `up-to-date` exit in `quantex upgrade`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `self-upgrade`: when `latestVersion` cannot be resolved, `quantex upgrade` MUST NOT claim the CLI is up to date solely because semantic comparison is inconclusive.

## Impact

- Affected code: `src/commands/upgrade.ts`, `test/commands/upgrade.test.ts`.
