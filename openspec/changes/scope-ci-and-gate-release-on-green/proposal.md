## Why

Recent GitHub Actions runs are paying full three-OS CI cost for process-only changes such as OpenSpec archive PRs, even though those changes do not alter the shipped CLI surface. In the same release window, the repository also published releases after `main` push CI had already failed, which breaks the expectation that release automation only proceeds from a green protected branch state.

## What Changes

- Scope merge-gating CI so that process-only changes still run lint and validation but do not spend full cross-platform test cost.
- Preserve the existing required CI job names so GitHub rulesets can continue to gate merges without manual per-PR overrides.
- Make release automation wait for a successful `main` or `beta` CI completion before running release-please or publishing artifacts.
- Update durable workflow docs and specs so the repository explicitly documents the CI scope split and the release-on-green requirement.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `code-quality-tooling`: CI gating requirements will distinguish process-only changes from product-impacting changes while keeping required lint and merge-gating status contexts stable.
- `release-workflow`: Release automation will require a successful protected-branch CI result before creating Release PRs or publishing a GitHub/npm release.

## Impact

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `openspec/specs/code-quality-tooling/spec.md`
- `openspec/specs/release-workflow/spec.md`
- `docs/github-collaboration.md`
