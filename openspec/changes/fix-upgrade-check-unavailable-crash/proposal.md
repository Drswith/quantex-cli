## Why

When self-upgrade planning returns `check-unavailable` (for example because `releases/latest/download/manifest.json` is missing), normal `quantex upgrade` throws an internal error instead of returning the stable structured `NETWORK_ERROR` result that `--check` already emits. Live empty `v1.2.0` currently triggers this path for standalone binary installs.

## What Changes

- Handle `plan.status === 'check-unavailable'` for normal `quantex upgrade` the same way `--check` and `--dry-run` already do: emit structured `NETWORK_ERROR` with `status: 'check-unavailable'`.
- Do not mutate, and do not throw an unstructured internal error for this planned outcome.
- Add a regression test for `upgradeCommand()` without `--check`.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `self-upgrade`: unresolved latest version must produce a structured unavailable result for plain `quantex upgrade`, not only for `--check`.

## Impact

- `src/commands/upgrade.ts` command-layer handling of planned `check-unavailable`
- `test/commands/upgrade.test.ts` regression coverage
- OpenSpec `self-upgrade` delta for the plain-upgrade scenario

## Work-intake classification

Observable CLI self-upgrade behavior and structured error contract → OpenSpec required before implementation.
