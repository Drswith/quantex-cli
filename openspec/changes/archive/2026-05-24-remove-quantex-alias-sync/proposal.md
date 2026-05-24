## Why

The `quantex-cli` Release workflow still dispatches successful npm releases to the separate `Drswith/quantex` package repository. That cross-repository sync makes npm show `quantex` as a dependent of `quantex-cli` and incorrectly makes this project responsible for coordinating another package's update synchronization.

## What Changes

- Remove the Release workflow step that sends `repository_dispatch` events to `Drswith/quantex`.
- Stop requiring the `QUANTEX_SYNC_TOKEN` secret for any `quantex-cli` release path.
- Keep `quantex-cli` as the only npm package published by this repository.
- Keep the `qtx` and `quantex` binary command names in the `quantex-cli` package unchanged; this change only removes external `quantex` package synchronization.
- Document that `quantex` package updates and synchronization are owned entirely by the `quantex` project and are not coordinated by `quantex-cli`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: release publishing no longer dispatches separate `quantex` package synchronization after `quantex-cli` npm publish.

## Impact

- Affected workflow: `.github/workflows/release.yml`.
- Affected docs/specs: `docs/github-collaboration.md`, `openspec/specs/release-workflow/spec.md` through this change delta.
- Removed external dependency: `QUANTEX_SYNC_TOKEN` and repository dispatch access to `Drswith/quantex`.
- Out of scope: changing, unpublishing, synchronizing, or otherwise coordinating the existing npm `quantex` package from this repository.
