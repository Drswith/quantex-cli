## 1. OpenSpec And Design

- [x] 1.1 Write the proposal, design, and release-workflow spec delta for branch-state-based release target resolution.
- [x] 1.2 Update the task list after the intended workflow and validation surface is clear.

## 2. Workflow Reconciliation

- [x] 2.1 Add a typed release-target resolver script that selects publish, Release PR, or skip from successful push-side CI history plus branch state.
- [x] 2.2 Update `.github/workflows/release.yml` to use the resolver outputs for both `workflow_run` and `workflow_dispatch`.
- [x] 2.3 Add automated tests that lock the resolver behavior for stale CI runs, pending untagged release commits, and manual recovery.

## 3. Docs And Validation

- [x] 3.1 Update release workflow docs and collaboration docs to describe the new resolver and recovery behavior.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, `bun run openspec:validate`, and `bun run memory:check`.
