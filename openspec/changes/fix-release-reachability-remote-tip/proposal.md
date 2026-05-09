# Proposal: fix release resolver bootstrap and remote-tip reachability

## Problem

The release workflow runs `bun run scripts/release-target-resolution.ts` before any `bun` bootstrap, so the resolver can fail before branch-state reconciliation even starts on a fresh GitHub Actions runner. Separately, the resolver filters successful CI runs with `git merge-base --is-ancestor <run.headSha> HEAD`. After `actions/checkout` and a follow-up `git fetch` that only updates `refs/remotes/origin/<branch>`, local `HEAD` can lag `origin/<branch>` when the protected branch advanced between clone and fetch. Runs whose `head_sha` is on the true remote tip are then incorrectly excluded, which can defer or skip a required publish or refresh the wrong Release PR baseline.

## Approach

- Bootstrap `bun` before the release-target resolver runs, and keep that setup alive for later build/test/publish steps in the same job instead of re-installing it only after a release is already created.
- Resolve ancestry against `origin/<target_branch>` (after fetch), with fallback to `HEAD` when the remote ref is missing.
- After fetching tags and remote branch refs in `release.yml`, fast-forward the checked-out branch to `origin/<branch>` so the workspace matches reconciled protected-branch state.

## Scope

Release workflow and `scripts/release-target-resolution.ts` only.
