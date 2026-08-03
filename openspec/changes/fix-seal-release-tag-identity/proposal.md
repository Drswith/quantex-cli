## Why

`Seal Release` currently attempts to create an annotated version tag without configuring a Git committer identity, so a valid release commit cannot be sealed on a fresh GitHub Actions runner. The failure blocks `v1.8.0` publication after all protected-branch checks have passed.

## What Changes

- Configure a deterministic repository-local Git identity before `Seal Release` creates an annotated version tag.
- Add a workflow regression test that requires the identity configuration to precede tag creation.
- Preserve immutable-tag verification, protected-branch validation, and explicit tag publication behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: Require sealing to configure a deterministic Git committer identity before creating an annotated release tag.

## Impact

- Affects `.github/workflows/seal-release.yml`, release workflow tests, and the release-workflow contract.
- Does not change CLI behavior, package contents, version selection, or tag immutability.
