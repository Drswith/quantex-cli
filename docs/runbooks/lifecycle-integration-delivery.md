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

- Ordinary milestone PR: one commit, milestone branch -> integration; rebase merge preferred, squash merge second.
- Periodic synchronization: exact same-repository `main -> integration` PR; rebase merge preferred, squash merge second, content evidence required.
- Final promotion: exact same-repository `integration -> main` PR; rebase merge preferred, squash merge second, content evidence required.
- Forks, lookalike refs, temporary sync refs, and other multi-commit topologies do not receive an exception.

For every remaining pull request in this lifecycle, select rebase merge first. Use squash merge only when rebase is unavailable or unsafe and record that reason. Agents and automation must never select a merge commit or silently use it as a fallback. Rebase and squash may rewrite commit identity, so verification uses refreshed trees and content comparisons rather than source-tip ancestry or merge-parent count.

If an exact `main -> integration` PR has conflicts, stop. Do not push integration directly, disable its ruleset, or broaden the exception ad hoc. Create or amend an OpenSpec change for a verifiable conflict-resolution topology first.

## Worktree approval ledger

Main-sync and final-promotion approval evidence must survive a new shell, network retry, quota interruption, or agent continuation. Store it under the current worktree's Git metadata, never in a tracked worktree file:

```bash
set -euo pipefail
ledger_root=$(git rev-parse --git-path quantex/lifecycle-integration)
mkdir -p "$ledger_root"
```

Use `main-sync.approved` and `final-promotion.approved` under that directory. Each ledger contains exactly three lines in this order: approved target/base tip, approved source/head tip, expected result tree. Write through a temporary file and rename it atomically. Never rely on shell variables surviving the approval/merge boundary, and never stage or commit a runtime ledger.

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

Before every milestone, fetch both refs and test content synchronization:

```bash
set -euo pipefail
git fetch origin --prune
integration_tip=$(git rev-parse origin/codex/redesign-lifecycle-integration)
main_tip=$(git rev-parse origin/main)
integration_tree=$(git rev-parse "$integration_tip^{tree}")
expected_sync_tree=$(git merge-tree --write-tree "$integration_tip" "$main_tip")
test "$(git cat-file -t "$expected_sync_tree")" = tree
git rev-list --left-right --count "$main_tip...$integration_tip"

if test "$expected_sync_tree" = "$integration_tree"; then
  printf '%s\n' 'main content already synchronized; do not create a sync PR'
else
  printf '%s\n' 'main content differs; complete the reviewed main-sync flow'
fi
```

Only a difference between `expected_sync_tree` and `integration_tree` triggers the main-sync flow. The `rev-list` output is graph diagnostics only; after rebase or squash, divergent commit identities do not prove that content is missing. If merge-tree reports a conflict, stop for review rather than inferring sync state. Once content is synchronized, create a new worktree and branch from the refreshed integration ref. Each milestone must have its own implementation plan, TDD evidence, validation, spec review, quality review, PR, and precise OpenSpec task updates.

### Deliver a milestone

1. Normalize the milestone branch to one conventional commit.
2. Validate the PR body from `.github/pull_request_template.md` with `bun run pr:body:check`.
3. Set the PR base to `codex/redesign-lifecycle-integration`.
4. Wait for all six ruleset contexts and the separate PR Governance workflow.
5. Merge with rebase first, or squash only when rebase is unavailable or unsafe; never select a merge commit automatically.
6. Verify the merge and update only OpenSpec tasks whose full wording is satisfied.

A milestone merge is not archive eligibility. Both umbrella changes remain active, accepted deltas remain under `openspec/changes/`, and release/archive closure stay pending.

### Sync the latest main

Use only the exact same-repository head/base pair:

```text
head: main
base: codex/redesign-lifecycle-integration
```

The PR may contain multiple commits because each commit was already accepted on protected `main`. All integration checks still run. After review approves the exact tips and before merging, refresh and atomically persist the approved tips plus expected combined content tree:

```bash
set -euo pipefail
git fetch origin --prune
ledger_root=$(git rev-parse --git-path quantex/lifecycle-integration)
ledger="$ledger_root/main-sync.approved"
ledger_tmp="$ledger.tmp.$$"
mkdir -p "$ledger_root"
trap 'rm -f "$ledger_tmp"' EXIT
trap 'exit 1' HUP INT TERM
approved_base_tip=$(git rev-parse origin/codex/redesign-lifecycle-integration)
approved_source_tip=$(git rev-parse origin/main)
approved_expected_tree=$(git merge-tree --write-tree "$approved_base_tip" "$approved_source_tip")
test "$(git cat-file -t "$approved_expected_tree")" = tree
printf '%s\n%s\n%s\n' "$approved_base_tip" "$approved_source_tip" "$approved_expected_tree" >"$ledger_tmp"
mv "$ledger_tmp" "$ledger"
trap - EXIT HUP INT TERM
```

Immediately before the merge action, start from a fresh fetch and reload the ledger rather than reusing shell state:

```bash
set -euo pipefail
git fetch origin --prune
ledger=$(git rev-parse --git-path quantex/lifecycle-integration/main-sync.approved)
test "$(wc -l <"$ledger" | tr -d '[:space:]')" = 3
approved_base_tip=$(sed -n '1p' "$ledger")
approved_source_tip=$(sed -n '2p' "$ledger")
approved_expected_tree=$(sed -n '3p' "$ledger")
git rev-parse --verify "$approved_base_tip^{commit}"
git rev-parse --verify "$approved_source_tip^{commit}"
git rev-parse --verify "$approved_expected_tree^{tree}"
test "$(git rev-parse origin/codex/redesign-lifecycle-integration)" = "$approved_base_tip"
test "$(git rev-parse origin/main)" = "$approved_source_tip"
test "$(git merge-tree --write-tree "$approved_base_tip" "$approved_source_tip")" = "$approved_expected_tree"
: "${PR_NUMBER:?set PR_NUMBER to the approved main-sync pull request number}"
gh pr merge "$PR_NUMBER" --rebase --match-head-commit "$approved_source_tip"
```

If either remote tip differs, do not merge: recompute the expected tree, repeat content review and required checks, then atomically replace the ledger with the newly approved values. The command uses compare-and-swap through `--match-head-commit`; a head change makes it fail non-zero. If rebase is unavailable or unsafe, record the concrete reason first; a transient network failure is a rebase retry, not a squash reason. Then rerun the complete pre-merge block, replacing only its final command with `gh pr merge "$PR_NUMBER" --squash --match-head-commit "$approved_source_tip"`. Never use `--merge` or let automation choose a merge commit.

After merge, use another fresh process and reload the ledger again:

```bash
set -euo pipefail
git fetch origin --prune
ledger=$(git rev-parse --git-path quantex/lifecycle-integration/main-sync.approved)
approved_base_tip=$(sed -n '1p' "$ledger")
approved_source_tip=$(sed -n '2p' "$ledger")
approved_expected_tree=$(sed -n '3p' "$ledger")
test "$(git rev-parse origin/codex/redesign-lifecycle-integration^{tree})" = "$approved_expected_tree"
git diff --name-status "$approved_source_tip"..origin/codex/redesign-lifecycle-integration
git diff "$approved_source_tip"..origin/codex/redesign-lifecycle-integration
```

The remaining diff from the approved `main` source must contain only accepted lifecycle redesign content. Record the approved tips, expected tree, selected method, resulting protected-branch SHA, and reviewed content diff. Keep the ledger until that operation's closure evidence is durable, then it may be removed from Git metadata. Do not claim that the approved `main` tip is an ancestor of integration.

## Final promotion

Do not open the final PR until all of these conditions hold:

- `redesign-lifecycle-engine` reports exactly `74/74` based on genuine implementation and the clarified task 11.6 readiness contract.
- Actual current-spec synchronization and archive execution have not run early.
- All milestone PRs are merged and none remains open.
- A final exact main-sync has completed and expected-tree plus content-comparison evidence proves integration contains the latest approved `main` content alongside only accepted redesign work.
- Compatibility, unit, platform, sandbox, build, binary, package, release-artifact, and release-smoke evidence is green.
- The complete integration comparison contains only accepted redesign work.

Create the exact same-repository `integration -> main` PR. It may contain multiple reviewed milestone commits. After the normal `main` required checks and final code review approve exact tips, persist the final-promotion ledger atomically:

```bash
set -euo pipefail
git fetch origin --prune
ledger_root=$(git rev-parse --git-path quantex/lifecycle-integration)
ledger="$ledger_root/final-promotion.approved"
ledger_tmp="$ledger.tmp.$$"
mkdir -p "$ledger_root"
trap 'rm -f "$ledger_tmp"' EXIT
trap 'exit 1' HUP INT TERM
approved_base_tip=$(git rev-parse origin/main)
approved_source_tip=$(git rev-parse origin/codex/redesign-lifecycle-integration)
approved_expected_tree=$(git merge-tree --write-tree "$approved_base_tip" "$approved_source_tip")
test "$(git rev-parse "$approved_source_tip^{tree}")" = "$approved_expected_tree"
printf '%s\n%s\n%s\n' "$approved_base_tip" "$approved_source_tip" "$approved_expected_tree" >"$ledger_tmp"
mv "$ledger_tmp" "$ledger"
trap - EXIT HUP INT TERM
```

Immediately before selecting a merge method, start a fresh fetch, reload all three values, and prove both remote tips are still the approved tips:

```bash
set -euo pipefail
git fetch origin --prune
ledger=$(git rev-parse --git-path quantex/lifecycle-integration/final-promotion.approved)
test "$(wc -l <"$ledger" | tr -d '[:space:]')" = 3
approved_base_tip=$(sed -n '1p' "$ledger")
approved_source_tip=$(sed -n '2p' "$ledger")
approved_expected_tree=$(sed -n '3p' "$ledger")
git rev-parse --verify "$approved_base_tip^{commit}"
git rev-parse --verify "$approved_source_tip^{commit}"
git rev-parse --verify "$approved_expected_tree^{tree}"
test "$(git rev-parse origin/main)" = "$approved_base_tip"
test "$(git rev-parse origin/codex/redesign-lifecycle-integration)" = "$approved_source_tip"
test "$(git merge-tree --write-tree "$approved_base_tip" "$approved_source_tip")" = "$approved_expected_tree"
: "${PR_NUMBER:?set PR_NUMBER to the approved final-promotion pull request number}"
gh pr merge "$PR_NUMBER" --rebase --match-head-commit "$approved_source_tip"
```

Any drift or compare-and-swap failure stops promotion until the expected tree, comparison, checks, and review are refreshed and the ledger is replaced. If rebase is unavailable or unsafe, record the concrete reason first; a transient network failure is retried with rebase. Then rerun the complete pre-merge block, replacing only its final command with `gh pr merge "$PR_NUMBER" --squash --match-head-commit "$approved_source_tip"`. Never select a merge commit automatically.

After promotion, use another fresh process to reload the ledger and verify content:

```bash
set -euo pipefail
git fetch origin --prune
ledger=$(git rev-parse --git-path quantex/lifecycle-integration/final-promotion.approved)
approved_base_tip=$(sed -n '1p' "$ledger")
approved_source_tip=$(sed -n '2p' "$ledger")
approved_expected_tree=$(sed -n '3p' "$ledger")
test "$(git rev-parse origin/main^{tree})" = "$approved_expected_tree"
git diff --exit-code "$approved_source_tip" origin/main
```

This proves refreshed `main` has the approved promotion tree and all approved integration content. Keep the ledger until promotion closure evidence is durable. Do not require the integration tip to be an ancestor of `main` or require a two-parent commit.

Only the resulting `main` push may enter normal stable release classification. Integration itself must not publish.

## Post-promotion teardown

Keep integration available until the promotion and any release recovery are complete. Then:

1. Open a process-only cleanup PR to `main` that removes the temporary integration PR targets and multi-commit policy exceptions and updates this runbook/runtime guidance.
2. Verify the cleanup does not create product release intent.
3. Remove `protect-lifecycle-integration`, then delete the integration ref after confirming the recorded promotion result tree matched the approved integration content, reviewing any later `main`-only release/recovery delta, and confirming no recovery use remains; do not substitute a source-ancestor assertion for this evidence.
4. Synchronize accepted delta specs into `openspec/specs/`.
5. Run the repo-native archive-closure flow for both active changes and deliver the archive follow-up through protected `main`.
6. Remove merged milestone worktrees and local branches only after remote and archive closure are verified.

Promotion, release, teardown, and archive are separate closure states. Report each one explicitly.

## Rollback

- Before promotion: stop new milestone PRs and retain integration for diagnosis; `main` remains unchanged.
- During final review: fix through another ordinary PR to integration while its PR triggers and ruleset still exist.
- After promotion: use the normal protected-`main` revert and release-recovery flow; retain integration until recovery no longer needs it.

Never use `beta` as an integration substitute and never add integration to Release workflow triggers or manual release choices.
