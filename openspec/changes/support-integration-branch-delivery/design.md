## Context

`redesign-lifecycle-engine` is an active umbrella change delivered through reviewed milestones. It is currently tracked independently at `8/74`; its task numbers, checkboxes, 74-task denominator, implementation scope, and completion credit remain owned by that change. Its current task `11.6` couples current-spec synchronization/archive execution to completion, which would make a pre-promotion `74/74` gate circular when archive execution is required to remain post-promotion. This delivery change permits only a semantic clarification of `11.6` so pre-promotion follow-up readiness can be completed without executing archive closure early. The default branch remains the stable release line, and the existing Release workflow recognizes only `main` and `beta`.

The delivery mechanism needs repository workflow support before lifecycle code can rely on it. The temporary branch `codex/redesign-lifecycle-integration` has therefore been created from an exact `origin/main` commit with no product delta. A single process-only bootstrap pull request can safely teach the existing `main` CI and governance checks about the temporary topology. After that bootstrap merges, the integration ref can be synchronized exactly to the resulting `main` tip before protection is enabled.

This design crosses GitHub Actions, PR governance, release routing, repository rulesets, runbook/runtime guidance, and OpenSpec closure. It does not change Quantex CLI behavior.

Stakeholders are maintainers delivering lifecycle milestones, reviewers protecting `main`, release automation, and agents responsible for OpenSpec/archive closure.

## Goals / Non-Goals

**Goals:**

- Aggregate lifecycle redesign milestones on a temporary protected branch without making that branch a release line.
- Apply the same six live `protect-main` required contexts to integration and `main`, while keeping PR Governance as a separate all-PR workflow.
- Preserve deliberate formatter-ignore boundaries for golden fixtures without letting an all-ignored lint-staged match block a milestone commit.
- Preserve the repository's single-commit default and allow multi-commit history only for two exact, same-repository synchronization/promotion topologies.
- Make setup, steady-state operation, final promotion, teardown, spec synchronization, and archive closure one explicit lifecycle.
- Keep the redesign umbrella change independent and require genuine `74/74` completion before final promotion.

**Non-Goals:**

- Creating a permanent `develop` branch, a second release channel, or a workflow orchestration product.
- Publishing from integration, generating integration Release PRs, or deriving an npm tag/channel from integration.
- Merging any lifecycle redesign implementation into `main` through the bootstrap pull request.
- Replacing the existing six contexts, weakening `main` protection, or adding integration `push` triggers to CI or Sandbox Tests.
- Formatting golden fixtures that are deliberately excluded by `.oxfmtrc.json`, skipping hooks, or suppressing formatter/linter failures for supported staged files.
- Renumbering `redesign-lifecycle-engine` tasks, changing its checkbox count or 74-task denominator, expanding its implementation scope, or awarding completion credit before the clarified criteria are met. Only task `11.6` wording may be clarified to separate post-promotion follow-up readiness from later execution.

## Decisions

### 1. Use a temporary protected aggregation branch, not a second release line

The exact integration ref is `codex/redesign-lifecycle-integration`. It exists only for the lifecycle redesign delivery window. Milestone pull requests target this branch; ordinary product work continues to target the normal protected release branches.

Integration is never a release source. It is absent from Release `workflow_run` branches, manual target choices and validation, release-please target selection, and Release PR base acceptance; those positive entry allowlists prevent release-target resolution and npm tag/channel derivation from receiving it. A successful integration pull request or merge can prove code quality but cannot publish a GitHub Release or npm package.

The current production release surfaces already use a positive `main`/`beta` allowlist. Bootstrap therefore adds regression coverage first and keeps those production workflow/resolver paths unchanged when the tests prove the boundary. A production release change is allowed only when a focused regression test exposes a concrete path that accepts integration, and then only the smallest correction to restore the existing allowlist is in scope.

Direct milestone merges to `main` were rejected because they would expose partially integrated internals to the release line. A permanent development branch was rejected because it would create an enduring second governance and documentation surface. A prerelease channel was rejected because this work needs aggregation, not publication.

### 2. Bootstrap through one process-only `main` pull request, then protect the synchronized ref

Setup has a one-time sequence:

1. Create the integration ref from an exact observed `origin/main` SHA and verify the remote comparison is `0` commits ahead and `0` behind.
2. Deliver one process-only bootstrap pull request to `main`. It may change CI/Sandbox pull-request triggers and tests, PR policy tests/logic, release regression tests, runbook/runtime rules, this OpenSpec change, and the narrow `redesign-lifecycle-engine` task `11.6` semantic clarification. It MUST NOT contain lifecycle redesign implementation or change redesign task numbering, checkbox count, denominator, scope, or completion credit.
3. Let the existing `main` required checks validate that bootstrap pull request and merge it through the ordinary single-commit path.
4. Before applying the temporary ruleset, synchronize the still-unprotected integration ref to the exact post-bootstrap `main` tip and again verify `0` ahead and `0` behind. This is initialization, not the recurring main-sync exception.
5. Create a temporary integration ruleset that requires pull requests and the six live `protect-main` contexts listed below. After this point, no direct integration updates are allowed.

Creating the ruleset before post-bootstrap synchronization was rejected because the integration base would not yet contain the workflow and policy that are meant to protect it. Copying unreviewed workflow commits directly onto the protected branch was rejected because `main` must validate the durable process first.

### 3. Reuse the live `protect-main` contexts without adding integration pushes

Live ruleset `protect-main` requires these six exact check contexts:

- `classify`
- `lint`
- `test (ubuntu-latest)`
- `test (windows-latest)`
- `test (macos-latest)`
- `sandbox-tests`

The CI and Sandbox Tests `pull_request` base allowlists each gain the exact integration ref so all six contexts can be produced. Their `push` branches remain exactly `main` and `beta`; integration is not added. This prevents direct pushes from becoming an alternative integration path and avoids duplicate post-merge runs.

PR Governance already uses an unfiltered `pull_request` trigger and continues to run for every pull request, including integration. It remains an important policy check but is not one of the six live required status contexts and MUST NOT be represented as such in the temporary ruleset.

A separate integration workflow was rejected because duplicated job names and logic would drift from `main`. Adding integration to either workflow's `push` filter was rejected because it provides no additional merge gate and could be mistaken for a release-adjacent signal.

### 4. Treat an all-ignored lint-staged formatter match as a successful no-op

Lifecycle compatibility baselines include golden JSON under `test/fixtures`. The formatter configuration deliberately ignores that directory so formatting cannot silently rewrite hard fixture bytes, while the broad lint-staged JSON glob still selects those paths before oxfmt applies its own ignore rules. Pinned oxfmt exits non-zero when every path passed to one invocation is ignored, which made a valid fixture-only JSON group abort the Phase 0/1 commit even though repository-wide format validation was green.

Both lint-staged oxfmt commands use the pinned `--no-error-on-unmatched-pattern` option. This preserves the existing ignore configuration: an all-ignored matched set formats zero files and succeeds, while any supported staged JavaScript, TypeScript, JSON, or config file still runs through oxfmt and JavaScript/TypeScript still runs through `oxlint --fix`. The option does not bypass the hook or convert real formatter/linter failures on supported files into success.

Removing `test/fixtures` from the formatter ignore list was rejected because hard fixtures should not be mechanically rewritten. Narrowing lint-staged globs around one current fixture path was rejected because future ignored formatter paths could reproduce the same failure. Skipping the hook was rejected because the repository contract requires local pre-commit enforcement.

### 5. Keep multi-commit exceptions narrow and use linear merge methods

Ordinary pull requests continue to contain exactly one commit when evaluated by PR Governance. A multiple-commit pull request is permitted only when all repository identity and ref predicates match one of these shapes:

| Multi-commit operation | Base repository/ref | Head repository/ref | Merge-method order |
|---|---|---|---|
| Periodic main sync | this repository / `codex/redesign-lifecycle-integration` | this same repository / `main` | rebase first; squash only if rebase is unavailable or unsafe |
| Final promotion | this repository / `main` | this same repository / `codex/redesign-lifecycle-integration` | rebase first; squash only if rebase is unavailable or unsafe |

Forks, lookalike branch names, reversed refs, other bases, and other heads do not qualify. PR Governance receives base/head repository identity and exact refs from the pull-request payload and tests both allowed shapes and near misses. Release-please validation remains separate and does not create another integration exception.

The same ordering applies to every remaining ordinary milestone, process, synchronization, promotion, cleanup, and archive pull request in this lifecycle: use rebase merge when GitHub and repository governance can apply it safely, otherwise use squash merge. Agents and automation MUST NOT select a merge commit. A later human decision to use any other method requires an explicit contract amendment rather than an automatic fallback.

Before a recurring main-sync merge, the operator refreshes both remote refs, verifies the pull request contains only content newly accepted on `main`, and records the content tree expected from combining the approved base and head. The approved tips and expected tree are written atomically to a per-worktree Git metadata ledger resolved with `git rev-parse --git-path`, not to a tracked file or ephemeral shell-only variables. A fresh process MUST reload that ledger after another fetch and prove both remote tips still equal the approved values; any drift stops delivery until the result is recomputed, reviewed, and re-approved. After the rebase or squash merge, another fresh process reloads the ledger, refreshes the protected ref, and verifies its tree matches that expected result; the operator then reviews the two-tip content diff and confirms that only the accepted redesign delta remains between approved `main` and integration. Before final promotion, the operator applies the same durable-ledger and pre-merge drift checks, verifies there are no open lifecycle milestone pull requests, and verifies the comparison contains only the accepted redesign delta. Final promotion closes only when refreshed `main` has the ledger's expected result tree and no approved integration content is missing.

Because rebase and squash do not preserve source commit ancestry, `rev-list`, commit logs, and ahead/behind counts are graph diagnostics only. Main-sync is needed only when the merge-tree result calculated from the refreshed integration and `main` tips differs from the current integration tree; equality proves there is no content to synchronize even when the commit graph diverges.

Merge commits were rejected as the automatic delivery method because they create unnecessary graph branches for synchronization and promotion. Rebase is preferred because it keeps the protected target linear; squash remains the explicit second choice when rebase is unavailable or unsafe. Either method may rewrite commit identity, so delivery closure relies on refreshed comparison, expected-tree, changed-file, and content evidence rather than ancestry or parent-count claims. Branch-name-only detection was rejected because a fork could imitate the ref name.

### 6. Gate final promotion on redesign completion, not milestone count

Milestone merges into integration close only that milestone's PR and validation state. They do not make either OpenSpec change archive-eligible. `redesign-lifecycle-engine` stays active while its counter advances from `8/74`; this delivery change stays active throughout the branch lifecycle.

Before final promotion, Phase 0/1 may clarify only redesign task `11.6` so its checkbox means that the explicit post-promotion current-spec synchronization and archive follow-up is ready: owner, command path, ordering, validation, and protected-branch delivery are identified. The clarification MUST retain task number `11.6`, one checkbox, the 74-task denominator, implementation scope, and honest completion credit, and the clarification edit itself MUST leave the checkbox incomplete. It MUST NOT perform, claim, or require current-spec synchronization or archive execution before promotion.

This makes the gate acyclic: the other 73 redesign tasks complete on their existing terms, then clarified `11.6` may complete when post-promotion follow-up readiness is real, producing `74/74`. Actual current-spec synchronization and archive execution remain owned by this change's post-promotion teardown tasks.

Final promotion may open only after all of the following are true:

- `redesign-lifecycle-engine` reports exactly `74/74`: the other 73 tasks are complete on their existing terms and clarified `11.6` has genuine post-promotion follow-up readiness, without early spec synchronization or archive execution;
- all redesign validation and final release-artifact gates required by that change pass;
- integration has received a final same-repository `main` sync whose expected-tree and content-comparison evidence proves that the latest protected `main` content is present alongside the accepted redesign delta;
- no lifecycle milestone pull request remains open;
- the final `integration -> main` comparison has been reviewed as the complete accepted redesign and contains no unrelated product work.

The exact integration-to-`main` pull request then passes the normal `main` required checks and uses rebase merge, or squash merge only when rebase is unavailable or unsafe. Integration itself still does not release. Once the promotion result exists on `main`, normal `main` release classification and automation decide whether and how the product delta releases.

Archiving at `74/74` before promotion was rejected because implementation/readiness completion is not merge closure. Archiving on a milestone merge was rejected because the umbrella contract spans all milestones.

### 7. Treat teardown and archive closure as post-promotion work

The final promotion is followed by an explicit teardown:

1. Verify the promotion result on `main` and record the approved base/head tips, selected linear merge method, expected result tree, and refreshed content comparison.
2. Deliver a process-only cleanup pull request to `main` that removes integration-specific CI targeting and temporary PR-policy exceptions, and updates runtime/runbook guidance to the completed state. It MUST NOT publish a release by itself.
3. Remove the temporary integration ruleset, then delete the temporary integration branch after the cleanup is merged and no recovery use remains.
4. Reconcile accepted delta requirements into current specs, preserving only the durable conditional/closure rules and keeping transient execution evidence in the archived changes or runbook history.
5. Run the repo-native archive-closure flow for both `redesign-lifecycle-engine` and `support-integration-branch-delivery`, validate the resulting OpenSpec state, and deliver the archive follow-up through the normal protected-branch PR path.

Neither active change is archive-eligible before final promotion, workflow cleanup, ruleset/branch cleanup, and current-spec synchronization are complete. Release closure and archive closure are reported separately; a successful release does not archive either change automatically.

Leaving dormant integration triggers and policy exceptions in place was rejected because the branch is intentionally temporary. Automatic bot-driven archive PRs were rejected because the repository requires agent-owned archive closure.

## Risks / Trade-offs

- [The temporary branch diverges from new `main` fixes] -> Use only the exact same-repository `main -> integration` PR topology, require the six contexts, apply rebase first or squash second, and verify the expected result tree and remaining content diff before the next milestone.
- [A broad multi-commit exemption weakens PR governance] -> Match repository identity plus both exact refs, test near misses, and remove the exemption during teardown.
- [Integration accidentally becomes releasable] -> Keep a positive `main`/`beta` release allowlist at every entry point and add negative tests proving workflow, manual, and Release PR gates stop integration before resolver and npm-channel paths.
- [The initial ruleset protects stale workflow content] -> Create protection only after the post-bootstrap exact synchronization is verified `0/0`.
- [Golden fixtures make pre-commit fail despite being deliberately ignored] -> Keep ignore boundaries intact and let oxfmt's all-ignored matched set succeed without suppressing checks on supported staged files.
- [Partial redesign reaches `main`] -> Allow only process/bootstrap changes before the `74/74` gate and review the complete final comparison.
- [Task `11.6` creates a promotion/archive dependency cycle] -> Clarify only its readiness semantics without renumbering, changing the denominator or scope, awarding early credit, or executing post-promotion work before promotion.
- [Two active changes are archived too early] -> Model milestone merge, final promotion, release, teardown, spec sync, and archive as distinct closure states.
- [Synchronization or promotion creates abnormal graph history] -> Prefer rebase for every pull request, use squash only as the documented fallback, never let an agent or automation select a merge commit, and use content evidence because linear methods do not preserve source-tip ancestry.

## Migration Plan

### Setup

1. Add focused failing CI/Sandbox trigger and PR-policy tests for the exact branch/topology, plus release regression tests that prove the existing positive `main`/`beta` allowlist.
2. Implement the smallest CI/Sandbox and PR-policy changes that satisfy those tests, keep production release routing unchanged unless a regression exposes a gap, clarify redesign task `11.6`, and update the operator runbook and central runtime rules.
3. Validate and deliver the process-only bootstrap pull request to `main`; reject it if lifecycle implementation appears in the diff.
4. Synchronize integration to the exact resulting `main` tip while it is still unprotected; verify the remote comparison is `0/0`.
5. Create the temporary ruleset with pull requests and the six required contexts, then verify branch settings from the live repository.

### Runtime

1. Verify lint-staged can accept deliberately formatter-ignored compatibility fixtures without formatting them or bypassing supported-file checks.
2. Deliver lifecycle milestones as ordinary single-commit pull requests to integration.
3. When `main` advances, open the exact same-repository `main -> integration` pull request, pass all six contexts, record the expected result tree, and merge it with rebase first or squash second; then verify the refreshed integration tree and remaining content diff.
4. Continue reporting milestone closure separately while both OpenSpec changes remain active.

### Final promotion and teardown

1. Confirm the other 73 redesign tasks and clarified `11.6` follow-up readiness produce genuine `74/74`, then verify full validation, final main sync, clean PR inventory, and the complete comparison; do not execute spec sync/archive yet.
2. Merge the exact integration-to-`main` promotion pull request with rebase first or squash second, verify the refreshed `main` result tree and content equality, and let normal `main` release automation evaluate the promoted product delta.
3. Merge the process-only workflow/policy cleanup, remove the temporary ruleset and branch, synchronize current specs, and archive both changes through an explicit follow-up.

Rollback before final promotion is to stop new milestone PRs, retain integration for diagnosis, and leave `main` unchanged. Rollback after promotion follows the normal protected-`main` revert/release process; the integration branch is retained until cleanup confirms it is no longer required for recovery.

## Open Questions

None. The exact branch names, six contexts, two allowed multi-commit topologies, rebase-first/squash-second merge ordering, content-based closure evidence, non-release boundary, `74/74` gate, and post-promotion teardown/archive order are fixed by this change.
