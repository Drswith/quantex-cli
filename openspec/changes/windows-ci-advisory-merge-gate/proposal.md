# Proposal: windows-ci-advisory-merge-gate

## Why

Windows CI flakes (for example Vitest timeouts on `windows-latest`) currently fail `ci.yml` and block merge and release tagging, even when Ubuntu and macOS pass. Delivery simplification step 2 keeps Windows coverage visible while removing it from the merge/release gate.

## What Changes

- Keep the `test (windows-latest)` job in `ci.yml` on the same product-matrix trigger as today.
- Mark that job so a Windows failure does not fail the overall `ci.yml` run (`continue-on-error: true`) and document the policy in workflow comments.
- Update required merge-gate contracts so Windows is advisory signal, not a required branch-protection context.
- Align collaboration/runbook docs and workflow contract tests with the new gate policy.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-quality-tooling`: Windows product-matrix coverage remains required to run and remain visible, but a Windows failure MUST NOT fail `ci.yml` or block merge.
- `release-workflow`: Protected-branch required status checks drop `test (windows-latest)` while retaining lint, governance, Ubuntu, and macOS.

## Impact

- `.github/workflows/ci.yml`
- `test/workflow-classification.test.ts`
- `docs/github-collaboration.md`, `docs/runbooks/releasing-quantex.md`
- `docs/adr/0009-workflow-v2.md` (short amendment note)
- `openspec/specs/{code-quality-tooling,release-workflow}/spec.md` (via this change's deltas)

No CLI behavior, catalog, canary/sandbox, governance-on-release-PRs, release-please collapse, Core publishing, or OpenSpec/memory lint-gate changes.

## Intake classification

Durable GitHub Actions merge-gate / required-check process contract change; OpenSpec required.
