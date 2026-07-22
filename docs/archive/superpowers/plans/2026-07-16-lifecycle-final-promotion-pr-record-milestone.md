# Lifecycle Final Promotion PR Record Milestone

## Goal

Record the exact final promotion pull request after it exists and only after its complete integration-to-`main` comparison and body have been reviewed. This process-only milestone may complete `support-integration-branch-delivery` task 4.3 and no later task.

Base: `origin/codex/redesign-lifecycle-integration@d91e1625e631ebe53e9fcd559b1014729cb49b6f`

Delivery target: `codex/redesign-lifecycle-integration`

## Entry evidence

- Final promotion PR #468 is an open Ready same-repository PR from `codex/redesign-lifecycle-integration` to `main`.
- Refreshed base is `main@2ca25c3cfebae5b2db568827677fde9fe40f88a0` and source is `codex/redesign-lifecycle-integration@d91e1625e631ebe53e9fcd559b1014729cb49b6f`.
- `git merge-tree --write-tree origin/main origin/codex/redesign-lifecycle-integration` and the source tree both equal `15aaa2f5c8498296f3ff3923661057a76c5dc23c`.
- The complete comparison contains 17 accepted commits and 349 files (+46,616/-5,982), mapped to reviewed lifecycle/integration PRs #443, #445, #447-#451, #453, #458-#462, and #464-#467.
- The PR body passed the repo-native policy locally. Its initial `refactor:` title was rejected remotely because product-impacting PRs require a release-worthy title; the title was corrected to `feat(lifecycle): promote redesigned lifecycle engine` and release intent to a backward-compatible minor release.
- `redesign-lifecycle-engine` is 74/74 and active. `support-integration-branch-delivery` is 21/30 before this milestone. Neither change is archived or synchronized into current specs early.
- Integration has no Release workflow run and no lifecycle milestone PR remains open.

## Scope boundaries

- Change only this plan, `.superpowers/sdd/progress.md`, and the task 4.3 checkbox.
- Do not modify product code, workflows, current specs, release configuration, or archive state.
- Do not mark task 4.4 until the final PR's required `main` contexts and final review approve the exact refreshed tips and the final-promotion ledger has been persisted and revalidated.
- Do not mark task 4.5 until promotion is merged and normal `main` release automation has been classified and reported.
- Do not use auto-merge or merge commits. This milestone uses manual rebase merge first and squash only as a documented fallback.

## Task 1: Revalidate the promotion artifact

Refresh the PR and remote refs. Confirm #468 remains the exact same-repository integration-to-`main` PR, its title/body pass policy, its base/source tips match the reviewed comparison, no integration milestone is open, and no Release workflow has run for integration. Stop and recompute on tip drift.

## Task 2: Record earned OpenSpec progress

Mark only support task 4.3 complete. Leave 4.4-5.6 unchecked and keep both OpenSpec changes active and unarchived. Update `.superpowers/sdd/progress.md` with resumable evidence and next conditions.

## Task 3: Validate the process-only diff

Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run openspec:validate`, `bun run memory:check`, `git diff --check`, and the OpenSpec apply progress commands. A local full product test rerun is not required because this tracked diff is documentation/OpenSpec-checkbox only; the integration PR must still receive all six remote required contexts.

## Task 4: Review and deliver to integration

Review the complete tracked diff for scope and evidence accuracy. Prepare a PR body from `.github/pull_request_template.md`, validate it with `bun run pr:body:check`, commit one conventional process-only commit, push, and create a Ready PR to integration. Wait for all six integration contexts and PR Governance. Merge manually with rebase first or squash only after recording a concrete fallback reason.

## Next milestone after merge

Refresh #468 and both remote tips because merging this milestone advances integration and therefore updates the final PR head. Recompute the expected tree, update #468's exact source/tree and task count in its validated body, wait for every required `main` context plus final review, then persist and reload the final-promotion ledger. Stop on any base/source drift. Attempt manual rebase merge with `--match-head-commit` first; use squash only if rebase is rejected or unsafe for a recorded concrete reason.

## Recovery rule

Resume the first incomplete row in `.superpowers/sdd/progress.md`. Network failures retry only the interrupted read/push/PR operation. Any main, integration, or #468 head drift invalidates the current content evidence and requires a fresh comparison and PR-body update before continuing.
