## Context

Release-please already owns version-file updates, changelog generation, and the split between Release PR creation and GitHub Release publication. Quantex wraps that with two repository-specific layers:

- `release.yml` decides when release-please should run.
- `release-pr-automerge.yml` validates generated Release PRs before enabling bot auto-merge.

The duplicate `0.13.0` incident shows that only validating title shape and changed-file scope is not enough. If release-please computes from stale state, Quantex will currently auto-merge that bad Release PR.

## Goals

- Let release-please use current release state instead of a stale manual baseline override.
- Reject generated Release PRs that do not advance the version on `main` or `beta`.
- Keep the fix narrow: do not replace release-please or add manual release orchestration.

## Non-Goals

- Rebuild release-please state in custom repository scripts.
- Change the release trigger taxonomy for normal docs/process PRs.
- Alter published tag naming, npm tags, or artifact publication behavior.

## Decisions

### 1. Remove the stale `last-release-sha` override

`last-release-sha` is an escape hatch, not a steady-state source of truth. Keeping a hard-coded April 24 SHA after multiple successful releases lets release-please anchor future planning to history that predates the current published version. Removing that override returns baseline selection to the current manifest, tags, and release-please's native logic.

### 2. Validate version monotonicity in Release PR automerge

Auto-merge should only be enabled for generated Release PRs that advance the version on the base branch. The validator can read the current `package.json` version from the PR base ref and compare it against the semantic version parsed from the Release PR title. If the generated version is less than or equal to the base-branch version, the workflow should fail and leave the PR unmerged.

This guard blocks duplicate release PRs even if release-please regresses for another reason in the future.

### 3. Keep validation inside the dedicated Release PR workflow

The monotonic-version check belongs with the existing release branch validator because it depends on generated Release PR state, base-branch version files, and automerge policy. It should remain separate from normal contributor PR body governance.

### 4. Import Release PR policy from a trusted ref under `pull_request_target`

`pull_request_target` workflows run with base-repository credentials. If the job checks out `pull_request.head.sha` and then `import`s repository JavaScript before proving the PR head belongs to this repository, a forked PR can substitute malicious `scripts/release-pr-policy.js` and execute it during module load (before the fork guard runs).

The automerge job therefore checks out `pull_request.base.sha` (the merge base commit already on the protected branch) solely to load the pinned policy implementation. Validation still uses the GitHub API against the in-repo pull request (title, body, file list, and base-branch `package.json`).

## Risks and Mitigations

- Risk: removing `last-release-sha` could expose other release-please state drift.
  - Mitigation: the monotonic-version check still blocks obviously bad duplicate versions from being auto-merged.
- Risk: version comparison could mis-handle beta releases.
  - Mitigation: parse stable and prerelease numeric segments explicitly and compare them deterministically.
