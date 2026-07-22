# Lifecycle Final Validation and Promotion Readiness Milestone

Base: `origin/codex/redesign-lifecycle-integration@5ca76bd6964a69af5f5a5ff2a05eb44fb4d4d303`

Branch: `codex/redesign-final-validation`

OpenSpec changes: `redesign-lifecycle-engine`; `support-integration-branch-delivery`

## Goal

Complete OpenSpec tasks 11.1-11.6 from verified evidence, moving the active redesign from 68/74 to 74/74 without changing product behavior. Re-run the complete compatibility, unit, platform-independent sandbox, build, binary, package, release-artifact, and release-smoke gates against the aggregated integration tree; record the exact post-promotion spec-sync/archive follow-up; remove the delivery change's archive-completion cycle; harden the repo-native archive guard against incomplete task lists; and deliver the evidence as one reviewed pull request to `codex/redesign-lifecycle-integration`.

This milestone prepares final promotion but does not open or merge the integration-to-`main` PR. It does not synchronize current specs, archive either active OpenSpec change, remove temporary integration infrastructure, or trigger a release.

## Entry evidence

- PR #465 merged by rebase into integration as `5ca76bd6964a69af5f5a5ff2a05eb44fb4d4d303` after all required CI, platform, governance, and sandbox checks passed.
- No lifecycle milestone PR remains open against integration at milestone start.
- The refreshed `origin/main` tip is `2ca25c3cfebae5b2db568827677fde9fe40f88a0`.
- `git merge-tree --write-tree integration main` and the current integration tree both resolve to `aaf4c2a9d2c720a2fe8d4fd7a51dc5fafd116c67`; main content is already synchronized, so a main-sync PR would be redundant.
- `redesign-lifecycle-engine` is active at 68/74. Tasks 1.1-10.6 are complete; only 11.1-11.6 remain.

## Boundaries

- Do not change observable CLI behavior, schemas, provider/catalog contracts, state semantics, root exports, or release workflow triggers in this milestone.
- Do not update `openspec/specs/`, archive either active change, or create release intent before final promotion and teardown.
- Do not use `beta`, push integration directly, enable auto-merge, or select a merge commit.
- Keep the milestone branch to one conventional commit and target only `codex/redesign-lifecycle-integration`.
- Treat test, network, Modal, Docker, and GitHub interruptions as recoverable execution failures. Preserve committed checkpoints and rerun only the interrupted gate before repeating the complete final matrix.

## Task 1: Establish the final evidence matrix

Record the exact integration/main tips, expected synchronized tree, merged milestone inventory, open integration PR inventory, CodeGraph health, Bun version, Docker availability, and Modal availability. Stop if content synchronization differs or any implementation milestone remains open.

Historical evidence is checked per accepted milestone rather than inferred from the final aggregate run:

| PR | Redesign scope | Final-head remote evidence | Local evidence recorded in the validated PR body |
| --- | --- | --- | --- |
| #445 | Phase 0/1 foundation | lint, three-platform tests, sandbox, validate-body; no failures | memory, format, typecheck, 744 tests, OpenSpec 16/16 |
| #450 | provider/catalog 4.1-4.14 | lint, three-platform tests, sandbox, validate-body; no failures | memory, format, typecheck, 883 tests, OpenSpec 16/16 |
| #451 | state/mutation 6.1-6.8 | lint, three-platform tests, sandbox, validate-body; no failures | memory, format, typecheck, 967 tests, OpenSpec and build |
| #453 | observation/read-only 5.1-5.7 | lint, three-platform tests, sandbox, validate-body; no failures | memory, format, typecheck, 1086 tests, read-only smoke, OpenSpec 16/16 |
| #458 | update/idempotency 7.1-7.6 | lint, three-platform tests, sandbox, validate-body; no failures | memory, format, typecheck, 1434 tests, OpenSpec 16/16, container |
| #459 | agent execution 8.1-8.4 | lint, three-platform tests, sandbox, validate-body; no failures | memory, format, typecheck, 1494 tests, OpenSpec 16/16, container |
| #460 | self-upgrade 9.1-9.5 | lint, three-platform tests, sandbox, validate-body; no failures | memory, format, typecheck, 1544 tests, OpenSpec and release gates |
| #461 | command registry 3.1-3.7 | lint, three-platform tests, sandbox, validate-body; no failures | memory, format, typecheck, 1564 tests, OpenSpec |
| #462 | compatibility 1.1, 1.4, 10.1-10.3 | lint, three-platform tests, sandbox, validate-body; no failures | memory, format, typecheck, 1568 tests, OpenSpec and package gates |
| #464 | process-tree regression for 8.3 | lint, three-platform tests, sandbox, validate-body; no failures | memory, format, typecheck and full behavior tests; no spec/doc delta |
| #465 | typed core/legacy removal 2.4, 10.4-10.6 | lint, three-platform tests, sandbox, validate-body; no failures | memory, format, typecheck, 1573 tests, OpenSpec and release-readiness gates |

Each row was re-queried from the merged PR's final head. `validate-body` proves the checked PR body was policy-valid; the body supplies the milestone-local OpenSpec/memory/test claims, and the protected remote contexts provide the cross-platform and Modal evidence.

## Task 2: Run static, protocol, and behavior validation

Run the repository-local Bun toolchain:

```bash
bun run lint
bun run format:check
bun run typecheck
bun run test
QTX_ISOLATION_AGENTS=pi,opencode bun run test:container
bun run openspec:validate
bun run memory:check
```

The authoritative real-isolation agent matrix is the CI-defined `pi,opencode` set. It must pass the complete Docker scenario list. Modal evidence comes from the required `sandbox-tests` context on the same product tree: #465 supplies the already-green baseline, and this milestone PR must pass the context again before merge. If an authenticated Modal CLI is locally available, also run `QTX_ISOLATION_AGENTS=pi,opencode bun run test:sandbox`; lack of local credentials is an environment limitation, not a claimed passing command.

The default local `pi,qoder` invocation remains diagnostic coverage. Its observed `@qoder-ai/qodercli@1.0.46` ESM/CommonJS failure under Bun 1.3.11 is recorded as an upstream failure after Quantex successfully installed and cleaned up the package; it is neither counted as a passing gate nor mislabeled as an expected skip.

## Task 3: Run distribution and release-readiness validation

Run in dependency order so generated metadata and artifacts are verified rather than assumed:

```bash
bun run build
bun run build:bin
bun run package:check
bun run release:artifacts
bun run release:smoke
```

Confirm both package aliases and both binaries remain covered by the existing compatibility suite and that integration produces no Release workflow run, Release PR, npm tag/channel, GitHub Release, or publication.

## Task 4: Record post-promotion follow-up readiness

Owner: the next Quantex-runtime closure session after the exact integration-to-`main` promotion, stable release/recovery verification, and temporary integration teardown are complete.

Preconditions:

1. Final promotion has merged and refreshed `origin/main` has the approved integration result tree.
2. Normal release automation has either completed successfully or been explicitly classified as not applicable/recovered.
3. The process-only teardown PR has merged, `protect-lifecycle-integration` is removed, and the integration ref is no longer needed for recovery.
4. Both `redesign-lifecycle-engine` and `support-integration-branch-delivery` remain active and unarchived until this follow-up starts.
5. Before either archive command runs, update both active delta specs to their post-teardown durable form, manually synchronize the accepted durable requirements into `openspec/specs/`, review the result, and commit a recoverable current-spec/delta-preparation checkpoint. The archive wrapper then uses its default `--skip-specs` path rather than applying deltas a second time.
6. Update support tasks 5.1-5.4 only after cleanup, protection removal, branch removal, and current-spec synchronization are real. Complete clarified tasks 5.5 and 5.6 only after the exact archive execution and post-merge verification paths are ready; actual archive execution, PR merge, and prepared verification remain mandatory external closure actions.

Ready-to-run path:

```bash
git fetch origin --prune
git worktree add -b codex/archive-lifecycle-redesign ../quantex-lifecycle-archive origin/main
cd ../quantex-lifecycle-archive
bun install --frozen-lockfile
bun run openspec:list
# Update both active delta specs to their durable post-teardown form, synchronize
# accepted requirements into openspec/specs/, review the diff, and update support
# tasks 5.1-5.4 only where the live cleanup/spec-sync evidence is complete.
bun run openspec:validate
bun run memory:check
git diff --check
git add openspec/specs openspec/changes/redesign-lifecycle-engine/specs openspec/changes/support-integration-branch-delivery/specs openspec/changes/support-integration-branch-delivery/tasks.md
git commit -m "docs(openspec): synchronize durable lifecycle contracts"
# Prepare .tmp/lifecycle-archive-pr.md from the repository template for both
# changes, validate it, then mark clarified support tasks 5.5/5.6 complete only
# when the exact commands below and the post-merge verification are ready.
bun run pr:body:check -- --body-file .tmp/lifecycle-archive-pr.md --title "docs(openspec): archive lifecycle redesign delivery"
# At this point, and not earlier, change support tasks 5.5 and 5.6 to `[x]`.
# Review that two-line task diff before checking the resulting task counts.
git diff --check
bun run openspec:instructions -- apply --change redesign-lifecycle-engine
bun run openspec:instructions -- apply --change support-integration-branch-delivery
# Stop unless the progress objects above report exactly 74/74 with zero
# remaining and 30/30 with zero remaining, respectively. The archive wrapper
# repeats this task-progress assertion before moving either active change.
git add openspec/changes/support-integration-branch-delivery/tasks.md
git commit -m "docs(openspec): complete lifecycle closure readiness"
bun run openspec:archive-closure -- --body-file .tmp/redesign-archive-pr.md --title "docs(openspec): archive lifecycle redesign delivery" redesign-lifecycle-engine
bun run openspec:archive-closure -- --body-file .tmp/delivery-archive-pr.md --title "docs(openspec): archive lifecycle redesign delivery" support-integration-branch-delivery
bun run openspec:validate
bun run memory:check
bun run lint
bun run format:check
bun run typecheck
```

The two archive invocations are intentionally separate recovery units because the wrapper is not atomic across changes. Before each invocation, check whether the exact change still exists under `openspec/changes/<id>` or already exists under `openspec/changes/archive/*-<id>`:

- active only: run that change's command;
- archived only: skip it and continue;
- both or neither: stop for state repair;
- first archived and second active after an interruption: rerun only the second command.

Use `test -d "openspec/changes/$change"` for the active check and `find openspec/changes/archive -maxdepth 1 -type d -name "*-$change"` for the archived check; require exactly one state before continuing. This state test is rerun in a fresh shell after any quota, network, or command interruption.

After both are archived, update the already validated final body from `.github/pull_request_template.md` with the actual two-change archive inventory (the generated single-change bodies are additional evidence), then validate it again with:

```bash
bun run pr:body:check -- --body-file .tmp/lifecycle-archive-pr.md --title "docs(openspec): archive lifecycle redesign delivery"
```

Review the synchronized current specs and archive diff again, commit the archive moves, preserve the granular recovery head, normalize the recovery commits to one process-only PR commit, push, and create a protected-`main` PR from the validated body file. After merge, the named closure owner refreshes `main`, verifies exactly one archived directory for each change, confirms neither remains in `openspec/changes/` or `bun run openspec:list`, checks a clean tree, and reports promotion, release, teardown, spec synchronization, archive PR merge, and archive verification separately.

## Task 5: Review and OpenSpec completion

Run independent specification and quality reviews over the complete branch diff and the recorded evidence. Fix every Critical/Important finding and rerun affected gates. Mark 11.1-11.6 complete only after their full wording is satisfied; confirm `bun run openspec:list` reports `redesign-lifecycle-engine` at exactly 74/74 while the change remains active and unarchived.

## Task 6: Normalize and deliver the milestone

Re-fetch integration and repeat the merge-tree content synchronization check. Before rebasing, preserve the current head at a pre-rebase recovery ref. Rebase on the exact latest integration tip if it advanced, preserve the reviewed rebased history at a granular recovery ref, then normalize to one conventional commit. Prepare the PR body from `.github/pull_request_template.md`, validate it with `bun run pr:body:check`, push, and create a Ready PR to integration. Wait for all six required contexts plus PR Governance and review. Do not enable auto-merge.

## Recovery rule

Resume the first incomplete row in `.superpowers/sdd/progress.md`. Before continuing, inspect `git status`, the last checkpoint, current remote tips, OpenSpec count, CodeGraph pending sync, and any running Docker/Modal/GitHub operation. Commit reviewed documentation/evidence checkpoints before long external validation, split long gates into independently retryable commands, and preserve the last green evidence instead of restarting the entire milestone after quota or network interruption.
