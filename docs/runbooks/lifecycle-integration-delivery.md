# Lifecycle Integration Delivery

Use this runbook only while the active OpenSpec changes `redesign-lifecycle-engine` and `support-integration-branch-delivery` are being delivered through the temporary protected branch `codex/redesign-lifecycle-integration`.

The branch aggregates reviewed redesign milestones. It is not a release channel and must not publish an npm package, create a GitHub Release, or receive a Release PR. `main` remains the stable release source; `beta` remains the prerelease source.

## Fixed topology

```text
main
└── codex/redesign-lifecycle-integration
    ├── codex/redesign-<milestone-a>
    ├── codex/redesign-<milestone-b>
    └── codex/redesign-<milestone-c>
```

- Ordinary milestone PR: one commit, milestone branch -> integration.
- Periodic synchronization: exact same-repository `main -> integration` PR, merge commit required.
- Final promotion: exact same-repository `integration -> main` PR, merge commit required.
- Forks, lookalike refs, temporary sync refs, and other multi-commit topologies do not receive an exception.

If an exact `main -> integration` PR has conflicts, stop. Do not push integration directly, disable its ruleset, or broaden the exception ad hoc. Create or amend an OpenSpec change for a verifiable conflict-resolution topology first.

## Setup

### 1. Create the empty integration ref

Fetch the live remote and create integration from the exact current `origin/main` tip:

```bash
git fetch origin --prune
git branch codex/redesign-lifecycle-integration origin/main
git push --set-upstream origin codex/redesign-lifecycle-integration
git fetch origin --prune
git rev-list --left-right --count origin/main...origin/codex/redesign-lifecycle-integration
```

The initial comparison must be `0 0`. This one-time unprotected push must not contain redesign work.

### 2. Merge the process-only bootstrap

Deliver `support-integration-branch-delivery` to `main` as an ordinary single-commit PR. Its allowed scope is workflow targeting/tests, PR topology policy/tests, OpenSpec delivery contracts, and this workflow documentation. It must not contain lifecycle engine implementation.

The bootstrap adds the exact integration ref only to the `pull_request` base filters of CI and Sandbox Tests. It does not add integration to either workflow's `push` filter and does not change the Release `main`/`beta` allowlist.

### 3. Fast-forward before protection

After the bootstrap merges, perform the only direct integration update:

```bash
git fetch origin --prune
git merge-base --is-ancestor origin/codex/redesign-lifecycle-integration origin/main
git push origin origin/main:refs/heads/codex/redesign-lifecycle-integration
git fetch origin --prune
git rev-list --left-right --count origin/main...origin/codex/redesign-lifecycle-integration
```

The comparison must again be `0 0`. Confirm integration now contains the bootstrap workflow and policy before enabling protection.

### 4. Create the temporary ruleset

Create `protect-lifecycle-integration` for the exact integration ref. Mirror the live `protect-main` pull-request and non-fast-forward rules plus these six live required contexts:

- `classify`
- `lint`
- `test (ubuntu-latest)`
- `test (windows-latest)`
- `test (macos-latest)`
- `sandbox-tests`

PR Governance continues to run for every PR through its unfiltered trigger, but it is separate from those six ruleset contexts. Once the ruleset is active, do not update integration directly.

## Milestone runtime

### Start a milestone

Before every milestone, fetch both refs and inspect drift:

```bash
git fetch origin --prune
git rev-list --left-right --count origin/main...origin/codex/redesign-lifecycle-integration
```

If `main` has advanced, complete the exact main-sync flow below before branching. Then create a new worktree and branch from the refreshed integration ref. Each milestone must have its own implementation plan, TDD evidence, validation, spec review, quality review, PR, and precise OpenSpec task updates.

### Deliver a milestone

1. Normalize the milestone branch to one conventional commit.
2. Validate the PR body from `.github/pull_request_template.md` with `bun run pr:body:check`.
3. Set the PR base to `codex/redesign-lifecycle-integration`.
4. Wait for all six ruleset contexts and the separate PR Governance workflow.
5. Merge through an existing ordinary merge method.
6. Verify the merge and update only OpenSpec tasks whose full wording is satisfied.

A milestone merge is not archive eligibility. Both umbrella changes remain active, accepted deltas remain under `openspec/changes/`, and release/archive closure stay pending.

### Sync the latest main

Use only the exact same-repository head/base pair:

```text
head: main
base: codex/redesign-lifecycle-integration
```

The PR may contain multiple commits because each commit was already accepted on protected `main`. All integration checks still run. Merge with a merge commit, never squash or rebase, then verify:

```bash
git fetch origin --prune
git merge-base --is-ancestor origin/main origin/codex/redesign-lifecycle-integration
```

Record the approved base/head tips and the resulting two-parent merge SHA.

## Final promotion

Do not open the final PR until all of these conditions hold:

- `redesign-lifecycle-engine` reports exactly `74/74` based on genuine implementation and the clarified task 11.6 readiness contract.
- Actual current-spec synchronization and archive execution have not run early.
- All milestone PRs are merged and none remains open.
- A final exact main-sync has completed and current `main` is an ancestor of integration.
- Compatibility, unit, platform, sandbox, build, binary, package, release-artifact, and release-smoke evidence is green.
- The complete integration comparison contains only accepted redesign work.

Create the exact same-repository `integration -> main` PR. It may contain multiple reviewed milestone commits, but it must merge with a merge commit after the normal `main` required checks and final code review pass. Verify the merge parents against the approved refreshed tips.

Only the resulting `main` push may enter normal stable release classification. Integration itself must not publish.

## Post-promotion teardown

Keep integration available until the promotion and any release recovery are complete. Then:

1. Open a process-only cleanup PR to `main` that removes the temporary integration PR targets and multi-commit policy exceptions and updates this runbook/runtime guidance.
2. Verify the cleanup does not create product release intent.
3. Remove `protect-lifecycle-integration`, then delete the integration ref after confirming it is an ancestor of `main` and no recovery use remains.
4. Synchronize accepted delta specs into `openspec/specs/`.
5. Run the repo-native archive-closure flow for both active changes and deliver the archive follow-up through protected `main`.
6. Remove merged milestone worktrees and local branches only after remote and archive closure are verified.

Promotion, release, teardown, and archive are separate closure states. Report each one explicitly.

## Rollback

- Before promotion: stop new milestone PRs and retain integration for diagnosis; `main` remains unchanged.
- During final review: fix through another ordinary PR to integration while its PR triggers and ruleset still exist.
- After promotion: use the normal protected-`main` revert and release-recovery flow; retain integration until recovery no longer needs it.

Never use `beta` as an integration substitute and never add integration to Release workflow triggers or manual release choices.
