# Fail closed when PR merge commit policy has no commit metadata

## Why

`validatePullRequestMergeCommitPolicy` treated an empty commit list as passing. If `PR_COMMITS_JSON` is missing due to a workflow wiring mistake or an empty payload, PR Governance would silently skip squash-merge co-author trailer checks.

## What changes

- Reject validation when zero commits are supplied, with remediation text pointing at `PR_COMMITS_JSON`.
- Add regression coverage and extend release-governance spec.

## Impact

- Affected: `scripts/pr-merge-commit-policy.ts`, `test/pr-merge-commit-policy.test.ts`, `openspec/specs/release-governance/spec.md`.
