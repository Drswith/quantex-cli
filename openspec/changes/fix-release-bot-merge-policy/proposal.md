## Why

`PR Governance` currently blocks the repository GitHub App release bot because `scripts/pr-merge-commit-policy.ts` treats all bot noreply authors as squash-merge trailer risks. That conflicts with the existing release flow, where release-please PRs already have dedicated scope validation and are auto-merged by trusted automation.

The current branch-name-only release-please carveout in `scripts/pr-body-policy.ts` is also too weak as a trust signal. A release-shaped exception should be granted only after the PR has passed the shared release PR validator.

## What Changes

- Validate release-please PRs inside `PR Governance` with the shared `release-pr-policy.js` contract before any release-specific exception is granted.
- Pass that validated release PR status into PR body and PR merge commit governance.
- Allow the repository release bot identity only for validated release PRs while keeping generic bot/co-author protections in place.

## Impact

- Release PR governance becomes internally consistent with release automation.
- Non-release PRs cannot bypass release-intent or merge-commit checks by only mimicking the release-please branch naming pattern.
- Protected-branch squash merge safeguards remain in force for ordinary bot-authored or multi-commit PRs.
