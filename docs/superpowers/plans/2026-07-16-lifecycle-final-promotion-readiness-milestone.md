# Lifecycle Final Promotion Readiness Milestone

Base: `origin/codex/redesign-lifecycle-integration@1d183699e6703ed126e8a9434175889d3b805471`

Branch: `codex/redesign-final-promotion-readiness`

OpenSpec change: `support-integration-branch-delivery`

## Goal

Close the completed milestone-runtime evidence and final-promotion eligibility gates without changing product code. This milestone may complete support tasks 3.1-3.4, 4.1, and 4.2 only after their live evidence is reviewed. It delivers one process-only pull request to `codex/redesign-lifecycle-integration` so the exact integration-to-`main` promotion can be opened from an integration tip that already records its eligibility.

Task 4.3 remains incomplete in this milestone because the final-promotion pull request does not exist yet. Tasks 4.4-5.6 remain post-PR or post-promotion work. Neither active OpenSpec change is synchronized into current specs or archived here.

## Entry evidence

- PR #466 merged manually with rebase into integration as `1d183699e6703ed126e8a9434175889d3b805471`; no auto-merge or merge commit was used.
- `redesign-lifecycle-engine` is active and unarchived at exactly 74/74.
- `support-integration-branch-delivery` is active and unarchived at 15/30.
- Refreshed `origin/main` is `2ca25c3cfebae5b2db568827677fde9fe40f88a0` and integration is `1d183699e6703ed126e8a9434175889d3b805471`.
- The integration tree and `git merge-tree --write-tree origin/main origin/codex/redesign-lifecycle-integration` both equal `4e065def9e403b3c463aa41142a18dadc6add46b`; the final main-sync is a verified content no-op, so a sync PR would be redundant.
- No pull request is open against integration, and no exact integration-to-`main` promotion pull request exists at entry.
- All accepted lifecycle milestones through #466 are merged. The runtime inventory includes implementation PRs #445, #450, #451, #453, #458-#462, #464-#466, process PRs #443 and #449, and same-repository main-sync PRs #447 and #448.
- Main-sync PRs #447 and #448 completed under the then-active contract that required the same-repository topology and merge-commit/two-parent result. PR #449 changed only future synchronization to rebase-first plus a durable approval ledger. Every checkpoint after #449 has been a merge-tree content no-op, so no later sync PR, merge, or approval ledger was triggered.
- `protect-lifecycle-integration` ruleset `18789571` remains active; integration has no Release workflow run.
- CodeGraph is initialized and current at 487 files, 4,529 nodes, and 12,203 edges.

## Boundaries

- Do not change CLI behavior, lifecycle implementation, schemas, package identity, current specs, workflow triggers, release routing, rulesets, or remote branch topology.
- Do not open the final integration-to-`main` PR until this readiness milestone has merged into integration.
- Do not mark support task 4.3 before that exact final PR exists; do not mark 4.4-5.6 before their external conditions are real.
- Do not create a redundant main-sync PR when refreshed content trees already prove no sync delta.
- Keep both OpenSpec changes active and unarchived; integration remains a non-release branch.
- Deliver one conventional commit to integration. Prefer manual rebase merge, use squash only if rebase is unavailable or unsafe, and never use auto-merge or a merge commit.

## Task 1: Review completed milestone runtime

Re-query every accepted milestone's final head and the integration pull-request inventory. Confirm each ordinary milestone was delivered as one commit, received the six required integration contexts, used rebase first or an explicitly justified squash fallback, updated only earned redesign tasks, and left both OpenSpec changes active. Review #447/#448 against the contract active when they merged; treat #449's rebase-first and durable-ledger rules as prospective, and prove every later checkpoint was a content no-op that never entered the PR/checks/ledger/merge block.

Confirm throughout the runtime interval that integration produced no Release workflow run, Release PR, npm tag/channel, package publication, or archive eligibility. If any live evidence contradicts these claims, leave the corresponding support task incomplete and stop delivery.

## Task 2: Prove final promotion eligibility

Re-check the complete final-validation evidence at the accepted integration tip:

- local lint, format, typecheck, OpenSpec, memory, 1,580-test, container, build, binary, package, release-artifact, and release-smoke evidence;
- remote three-platform, sandbox, lint, classification, and PR-body evidence on #466, including the successful macOS rerun after the isolated timeout test passed locally;
- redesign 74/74 with current-spec synchronization and archive still deferred;
- no open lifecycle milestone PR.

Refresh main and integration again. Require integration tree equality with the merge-tree result. Review the full `main..integration` name-status, stat, commit, and PR inventory as the accepted redesign program; stop if an unrelated delta appears. This content proof satisfies the final main-sync requirement without manufacturing an empty synchronization PR.

Only after the evidence is independently reviewed may support tasks 3.1-3.4, 4.1, and 4.2 change to `[x]`.

## Task 3: Validate the process-only readiness diff

The tracked diff must contain only:

- this milestone plan;
- the milestone progress checkpoint;
- the six earned support-task checkbox updates.

Install the repository-pinned dependencies and run:

```bash
bun install --frozen-lockfile
bun run lint
bun run format:check
bun run typecheck
bun run openspec:validate
bun run memory:check
git diff --check
```

The product and test tree is identical to the green #466 integration tree. The integration-target PR must still receive all six remote contexts, including the Ubuntu full test and sandbox context. Do not classify the earlier macOS timeout as a product failure: its isolated local rerun and remote rerun both passed without a code change.

## Task 4: Review and deliver to integration

Run independent specification and quality review over the complete diff and live evidence. Resolve every Critical/Important finding. Prepare the PR body from `.github/pull_request_template.md`, report implementation/repository/PR/merge/release/archive closure separately, and validate it with `bun run pr:body:check`.

Commit a recoverable checkpoint before remote operations. Re-fetch integration, preserve a pre-rebase recovery ref, rebase if the protected tip advanced, preserve the granular rebased head, and normalize to one conventional commit. Push and create a Ready PR to integration. Wait for the six required contexts plus PR Governance; do not enable auto-merge. After review and green checks, merge manually with rebase first or squash only as the documented fallback.

## Next milestone after merge

From refreshed integration, review and validate the final promotion PR body, then open the exact same-repository `codex/redesign-lifecycle-integration -> main` pull request. Record support task 4.3 only after that PR exists. Tasks 4.4 and 4.5 remain tied to required-main checks, durable approval-ledger drift verification, manual linear merge, refreshed main content proof, and normal stable release classification.

## Recovery rule

Resume the first incomplete row in `.superpowers/sdd/progress.md`. Inspect the live refs, open PRs, Release runs, OpenSpec counters, CodeGraph status, working tree, and any interrupted GitHub command before acting. Keep the latest reviewed checkpoint committed. Network or quota failures retry only the interrupted read/push/PR operation; tip drift invalidates the comparison and requires a fresh evidence review.
