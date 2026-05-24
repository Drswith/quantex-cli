## Why

The `quantex-cli` Release workflow still dispatches successful npm releases to the separate `Drswith/quantex` alias-package repository. That cross-repository sync makes npm show `quantex` as a dependent of `quantex-cli` and keeps release automation coupled to a package alias the primary project no longer wants to maintain from this repository.

## What Changes

- Remove the Release workflow step that sends `repository_dispatch` events to `Drswith/quantex`.
- Stop requiring the `QUANTEX_SYNC_TOKEN` secret for any `quantex-cli` release path.
- Keep `quantex-cli` as the only npm package published by this repository.
- Keep the `qtx` and `quantex` binary command names in the `quantex-cli` package unchanged; this change only removes external alias-package synchronization.
- Document that npm package-level cleanup for the existing `quantex` package is owned outside this repository.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: release publishing no longer dispatches alias-package synchronization after `quantex-cli` npm publish.

## Impact

- Affected workflow: `.github/workflows/release.yml`.
- Affected docs/specs: `docs/github-collaboration.md`, `openspec/specs/release-workflow/spec.md` through this change delta.
- Removed external dependency: `QUANTEX_SYNC_TOKEN` and repository dispatch access to `Drswith/quantex`.
- Out of scope: changing or unpublishing the existing npm `quantex` package, which is maintained by the separate alias repository.
