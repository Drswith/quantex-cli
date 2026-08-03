## Why

`Seal Release` currently attempts to create an annotated version tag without configuring a Git committer identity, so a valid release commit cannot be sealed on a fresh GitHub Actions runner. After recovering that tag, the checkout-free publish job also lacks an explicit repository context, causing `gh release` to fail outside a Git worktree. These failures block stable publication after all protected-branch checks have passed.

## What Changes

- Configure a deterministic repository-local Git identity before `Seal Release` creates an annotated version tag.
- Add a workflow regression test that requires the identity configuration to precede tag creation.
- Provide an explicit GitHub repository context to every `gh release` operation in the checkout-free publish job.
- Preserve immutable-tag verification, protected-branch validation, and explicit tag publication behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: Require sealing to configure a deterministic Git committer identity before creating an annotated release tag and require checkout-free publication to address the target repository explicitly.

## Impact

- Affects `.github/workflows/seal-release.yml`, `.github/workflows/release.yml`, release workflow tests, and the release-workflow contract.
- Does not change CLI behavior, package contents, version selection, or tag immutability.
