## Why

`quantex upgrade` crashes with an unstructured `Error` when self-upgrade planning cannot resolve an installable latest version. The application layer correctly returns a plan (`check-unavailable`) without mutating, but the command layer only maps that status under `--check` / `--dry-run` and then throws `Self-upgrade execution did not produce a result.` The same dispatch also misclassifies `--check` / dry-run `manual-required` plans as `NETWORK_ERROR`.

## What Changes

- Map unresolved latest (`check-unavailable`) to structured `NETWORK_ERROR` for plain `quantex upgrade`, not only `--check` / dry-run.
- Map `manual-required` to structured `MANUAL_ACTION_REQUIRED` for `--check` and dry-run, matching the existing apply-path contract.
- Keep the existing `--check` update-available and apply-path behaviors unchanged.
- Add regression tests that cover the previously untested `upgradeCommand()` + `check-unavailable` crash path and `--check` + `manual-required`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `self-upgrade`: Unresolved latest on `quantex upgrade` is a structured `NETWORK_ERROR`. `--check` / dry-run of a non-auto-update source stays `MANUAL_ACTION_REQUIRED`.

## Impact

- `src/commands/upgrade.ts`
- `test/commands/upgrade.test.ts`
- `openspec/specs/self-upgrade/spec.md` (via this change's delta)

## Non-Goals

- Changing latest-version resolution, registry selection, or install-source classification.
- Changing binary / managed upgrade execution, checksum, or rollback.
- Release workflow recovery (`#698` / `#699`).

## Intake classification

Observable CLI behavior and structured error contract; OpenSpec required.
