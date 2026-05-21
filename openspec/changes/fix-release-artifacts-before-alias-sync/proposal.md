## Why

The release workflow can publish the npm package before attempting alias-package synchronization, but a later alias sync failure currently prevents GitHub release binaries from being uploaded. This can leave a partially published release where self-upgrade and binary installers cannot fetch the matching artifacts.

## What Changes

- Upload GitHub release binary artifacts immediately after the package is published.
- Run alias-package synchronization only after core release artifacts are already attached to the GitHub Release.
- Keep alias synchronization strict when it runs; this change only reduces its blast radius over primary release artifacts.

## Capabilities

### New Capabilities

### Modified Capabilities

- `release-workflow`: publishing a release must prioritize attaching binary artifacts before auxiliary alias-package synchronization.

## Impact

- Affects `.github/workflows/release.yml`.
- Updates the `release-workflow` OpenSpec contract.
- No CLI runtime API, dependency, or schema changes.
