## Why

Implementation requested work-intake classification: this change modifies protected-branch release workflow behavior and durable release recovery rules, so it requires OpenSpec before file edits.

Quantex's `Release` workflow currently assumes a single `workflow_run.head_sha` is the correct release target. The `0.16.4` incident showed that this is not a durable assumption: an older successful `CI` run can reconcile branch state after a release PR has already merged, which leaves release-please in a merged-but-untagged state and makes later `Release` runs look successful without actually publishing.

## What Changes

- Replace single-run release targeting with a branch-state reconciler that derives the next release action from successful push-side `CI` history plus current branch release state.
- Prioritize publication of a successful but still-untagged `chore: release ...` commit before attempting to open or update another Release PR.
- Add an explicit manual recovery path that reuses the same resolver instead of bypassing normal release state checks.
- Document the resolver and stale-run behavior in the release workflow spec and runbook.

## Capabilities

### Modified Capabilities

- `release-workflow`: the Release workflow no longer relies on a raw `workflow_run.head_sha`; it reconciles branch release state and chooses between Release PR mode, publish mode, or clean skip.

## Impact

- Affected code: `.github/workflows/release.yml` plus a shared release-target resolver script and tests.
- Affected docs: release runbooks and GitHub collaboration flow wording for protected-branch release closure.
- Affected specs: `openspec/specs/release-workflow/spec.md`.
