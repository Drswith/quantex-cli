## Why

The Release PR automerge workflow runs on `pull_request_target` with elevated permissions but checked out the pull request head commit to import `scripts/release-pr-policy.js`. A contributor with a branch named like release-please could replace that module with a no-op and bypass file-scope and monotonic-version checks before auto-merge, which is a supply-chain and repository-integrity risk.

## What Changes

- Check out the repository at the pull request **base** SHA (or equivalent trusted default-branch ref) before importing the shared release PR policy module in the automerge workflow, so validation logic cannot be overridden by the PR head tree.

## Capabilities

### New Capabilities

### Modified Capabilities

- `release-governance`: Release PR automerge validation MUST load policy from a trusted ref, not the untrusted PR head commit.

## Impact

- Affected code: `.github/workflows/release-pr-automerge.yml`
- Affected specs: `openspec/specs/release-governance/spec.md` (via delta in this change)
