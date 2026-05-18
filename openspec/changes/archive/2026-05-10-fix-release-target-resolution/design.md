## Context

Quantex already separates release work into two release-please phases:

- normal release-worthy product merges create or update a Release PR
- merged `chore: release ...` commits create the tag, GitHub Release, npm publish, and attached binaries

The current workflow tries to choose between those phases from one event field: `workflow_run.head_sha`. That field is too narrow for the actual protected-branch lifecycle. A successful older `CI` run can execute after branch state has already advanced to a merged release commit, and the workflow has no durable way to reconcile "what should happen next" from repository state.

## Goals / Non-Goals

**Goals:**

- Resolve the next release action from current protected-branch state and successful push-side `CI` history.
- Prefer publishing a successful but untagged release commit over creating another Release PR.
- Keep manual recovery on the same code path as automatic release reconciliation.
- Add local tests for the resolver instead of leaving correctness buried in YAML conditionals.

**Non-Goals:**

- Replace release-please with a custom release orchestrator.
- Change versioning rules, tag naming, npm channels, or artifact packaging behavior.
- Repair the already-missed `v0.16.4` publication inside this same workflow refactor.

## Decisions

### 1. Introduce a release-target resolver script

The workflow will stop embedding target selection directly in shell steps. A dedicated script will:

- read the target branch from `workflow_run` or `workflow_dispatch`
- inspect successful push-side `CI` runs for that branch
- classify the corresponding commits as publish candidates, Release PR candidates, or non-release commits
- prefer the newest successful untagged release commit
- otherwise fall back to the newest successful release-worthy product commit

This keeps the branch reconciliation logic testable and removes dependence on one possibly stale `workflow_run.head_sha`.

Alternative considered: keep shell logic in `release.yml` and add more ad hoc `if` branches. Rejected because the failure is a state-machine bug, and hiding that logic in YAML would make it hard to test or reason about.

### 2. Treat publication as higher priority than PR preparation

If branch history contains a successful `chore: release <version>` commit whose `v<version>` tag does not exist yet, the workflow should publish that commit before creating or updating another Release PR. This prevents later docs or archive pushes from starving an already-green release publication.

Alternative considered: always act on the newest successful release-worthy commit. Rejected because a later docs or fix commit could outrank a pending untagged release commit and leave publication permanently deferred.

### 3. Share the same resolver between automatic and manual runs

`workflow_dispatch` should not bypass CI-derived release state. It should select a protected branch and run the same resolver so manual recovery uses the same publish/PR/skip rules as automation.

Alternative considered: leave manual dispatch on raw `GITHUB_SHA`. Rejected because it keeps recovery behavior divergent from the automated path and makes stale-state incidents harder to reproduce.

## Risks / Trade-offs

- [Risk] The resolver may encounter more than one successful untagged release commit in branch history. → Mitigation: treat that as an explicit invalid state in the resolver output and fail loudly instead of silently guessing.
- [Risk] GitHub Actions API ordering or filtering could drift. → Mitigation: use repository-local tests for the selection algorithm and keep the API fetch narrow to successful push-side `CI` runs on the target protected branch.
- [Risk] The workflow becomes slightly more complex. → Mitigation: move complexity into a typed script with unit tests and keep `release.yml` as orchestration only.

## Migration Plan

1. Add the resolver script and tests.
2. Update `release.yml` to fetch branch state, run the resolver, and dispatch to PR or publish mode from its outputs.
3. Update the release workflow spec and runbooks to describe the new branch-state reconciliation behavior.
4. Validate locally with workflow-adjacent tests plus the standard repo checks for workflow changes.

## Open Questions

- None. The workflow should fail loudly if it encounters more than one successful untagged release commit, because that state needs human intervention rather than silent automation.
