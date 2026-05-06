## Why

`validatePullRequestMergeCommitPolicy()` returned success when no commits were supplied. If `PR_COMMITS_JSON` were missing due to workflow wiring or an API issue, PR Governance would silently skip the squash-merge co-author trailer risk check.

## What Changes

- Fail closed when the PR merge commit policy receives zero commits.
- Add regression coverage for the empty-input case.
- Record the fail-closed behavior in release-governance OpenSpec.

## Capabilities

### Modified Capabilities

- `release-governance`: PR merge commit governance MUST fail when commit metadata is unavailable.

## Impact

- Affected files: `scripts/pr-merge-commit-policy.ts`, `test/pr-merge-commit-policy.test.ts`, `openspec/specs/release-governance/spec.md`.
