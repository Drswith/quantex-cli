## Context

The repository already has two related CI patterns:

- merge-gating `ci.yml` classifies changed files and preserves stable required check contexts even when it skips expensive platform work for process-only changes
- dedicated `sandbox-tests.yml` runs remote Modal isolation after pushes to protected branches when lifecycle-sensitive files changed

The new requirement is to make sandbox validation a PR gate without reintroducing the exact deadlocks that the scoped CI matrix already solved.

## Decisions

### Reuse the shared path taxonomy

Instead of hard-coding a second workflow-only path list, the sandbox workflow will reuse `scripts/path-taxonomy.ts` and consume a new `sandboxRelevant` classification output. That keeps the lifecycle-sensitive path contract testable in one place and lets the workflow always publish the same `sandbox-tests` context.

### Keep the sandbox workflow separate from `ci.yml`

The Modal-backed workflow remains a dedicated workflow because it has different credentials, runtime cost, and operational failure modes than the normal cross-platform CI matrix. The merge gate is achieved by making the `sandbox-tests` job context required in the repository ruleset, not by folding Modal execution into the core CI workflow.

### Narrow the required PR smoke profile

The first implementation tried to run the full Modal scenario set inside the required pull-request gate. That proved too brittle because the `self-managed` self-upgrade path depends on additional packaging and local-registry assumptions that can fail independently of the workflow-gating objective.

The merge-gating profile therefore narrows pull requests to `managed`, `adopt-preinstalled`, `ambiguous-multi-method`, and `self-binary`. Protected-branch pushes, schedule, and manual dispatch keep the full default scenario set so the broader self-managed coverage still exists outside the required PR check.

### Always report the required context

The workflow will trigger on all pull requests targeting `main` or `beta` and on protected-branch pushes. A lightweight classification job runs first. The `sandbox-tests` job then chooses one of three paths:

1. unrelated change: report fast success without starting Modal
2. trusted lifecycle-sensitive pull request: install Modal and run `bun run test:sandbox` with the scoped merge-gating scenario list
3. fork lifecycle-sensitive pull request: report a documented success placeholder and require maintainer rerun from a trusted branch

Protected-branch pushes and non-PR entry points continue to run the full `bun run test:sandbox` scenario set after the same classification step.

This avoids the "required check never appeared" trap that would happen if workflow-level `paths` filters were left on a required check.

### Avoid `pull_request_target`

Using `pull_request_target` would expose Modal secrets to code from an untrusted fork. The design intentionally stays on `pull_request`, accepts the fork limitation, and documents the maintainer rerun expectation instead of weakening repository secret isolation.

## Files

- `.github/workflows/sandbox-tests.yml`
- `scripts/path-taxonomy.ts`
- `test/path-taxonomy.test.ts`
- `test/workflow-classification.test.ts`
- `docs/runbooks/modal-sandbox-testing.md`
- `docs/github-collaboration.md`
- `openspec/specs/code-quality-tooling/spec.md`
