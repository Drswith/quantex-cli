## Why

The lifecycle-engine redesign spans multiple reviewed milestones, but sending each intermediate implementation directly to `main` would expose the release line to a partially integrated architecture. Quantex needs a temporary, protected, explicitly non-release integration path whose bootstrap and eventual removal are themselves governed without changing the redesign implementation contract or its 74-task denominator beyond the narrow task `11.6` readiness clarification defined below.

This is a durable delivery-process change, so it requires an independent OpenSpec change before workflow, policy, runbook, or repository-ruleset implementation begins.

## What Changes

- Establish `codex/redesign-lifecycle-integration` as a temporary, protected aggregation branch initialized from the exact current `origin/main` commit and accepting changes only through pull requests after initialization.
- Permit one process-only bootstrap pull request to `main` so the existing `main` checks can validate the new CI, governance, release exclusion, runbook, and runtime rules before lifecycle implementation uses the integration branch. The bootstrap pull request MUST NOT contain lifecycle redesign implementation.
- Give pull requests whose base is exactly the integration branch the six live `protect-main` required contexts: `classify`, `lint`, `test (ubuntu-latest)`, `test (windows-latest)`, `test (macos-latest)`, and `sandbox-tests`. CI and Sandbox Tests MUST add the integration ref only to their `pull_request` base filters, never to their `push` filters. PR Governance continues to run for every pull request without a base filter, but it is not one of the six ruleset contexts.
- Keep formatter-ignored compatibility fixtures usable in milestone commits: lint-staged formatter commands MUST treat a matched set containing no formatter-supported files as a successful no-op without removing ignore boundaries or weakening formatting and linting for supported staged sources.
- Preserve single-commit pull requests by default while permitting multiple commits only for the verified same-repository `main` to integration synchronization topology and the exact integration to `main` final-promotion topology. For every remaining pull request in this delivery lifecycle, prefer rebase merge, use squash merge only when rebase is not safe or available, and never automatically select a merge commit.
- Prove with regression tests that the existing positive `main`/`beta` release allowlist excludes integration from Release `workflow_run`, manual release targets, Release PR targets, and npm tag or channel derivation. Production release routing changes only if those tests expose a concrete gap.
- Permit one narrow semantic clarification to `redesign-lifecycle-engine` task `11.6`: keep its number, checkbox, 74-task denominator, implementation scope, and completion credit unchanged while defining the task as readiness for the post-promotion spec-sync/archive follow-up. The clarification itself MUST NOT check the task early. The other 73 tasks plus later completed follow-up readiness may produce `74/74`; actual spec synchronization and archive execution remain post-promotion work.
- Permit the matching narrow closure clarification to this change's tasks `5.5` and `5.6`: preserve their numbers, checkboxes, 30-task denominator, implementation scope, and completion credit while defining them as readiness for the archive execution and post-merge verification steps that cannot occur until the active change itself is complete. Harden the repo-native archive wrapper to require actual task progress (`complete === total` and zero remaining) rather than artifact completeness. Actual archive execution and merge-result verification remain required external closure actions and MUST NOT be reported early.
- Keep this delivery change active across setup, milestone delivery, periodic `main` synchronization, final promotion, workflow/ruleset/branch teardown, current-spec synchronization, and post-promotion archive closure. Keep `redesign-lifecycle-engine` independent and active until its own 74 tasks are genuinely complete.
- Define teardown so temporary integration support is removed after final promotion and accepted deltas from both active changes reach explicit archive closure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-quality-tooling`: Extend CI and Sandbox Tests pull-request base filters to integration so its pull requests receive the six live `protect-main` contexts, keep both workflows' integration pushes untriggered, keep unfiltered PR Governance separate from required ruleset contexts, and let formatter-ignored milestone fixtures remain a successful lint-staged no-op.
- `project-memory`: Define the setup, runtime, final-promotion, teardown, and archive timing for a long-lived umbrella change delivered through milestone pull requests.
- `release-governance`: Narrowly permit multi-commit verified same-repository main-sync and final-promotion pull requests while retaining single-commit governance everywhere else, and require rebase-first, squash-second merge-method selection without automatic merge commits.
- `release-workflow`: Make the temporary integration branch non-release across automatic, manual, Release PR, and npm channel selection paths.

## Impact

- Affected repository surfaces: CI and Sandbox Tests pull-request triggers/tests, release regression tests, PR governance policy/tests, lint-staged formatter configuration/tests, Quantex runtime guidance, delivery runbooks, the repo-native archive task-completion guard, the narrow redesign task `11.6` and delivery tasks `5.5`/`5.6` closure clarifications, and a temporary GitHub ruleset/branch.
- Affected OpenSpec state: this change remains independent from `redesign-lifecycle-engine`; neither change may be archived merely because a milestone merges.
- No CLI command, runtime behavior, public API, published package identity, runtime dependency, release artifact, npm channel, or product release is added by this change.
- Within this lifecycle-delivery scope, the only change allowed to reach `main` before final promotion is the process-only bootstrap that enables and verifies this topology; unrelated normal `main` delivery continues under existing governance.
