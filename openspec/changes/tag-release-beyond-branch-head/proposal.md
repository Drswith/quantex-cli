## Why

`tag-release` decides whether to tag by reading the **branch head's** commit title. If any commit lands on `main` between the Release PR merge and the moment the job evaluates, the head is no longer the release commit, the job reports `noop (branch head is not a release commit)`, and the release is stranded: the version is materialized in `package.json`, `.release-please-manifest.json`, `build-meta.ts`, and `CHANGELOG.md`, but no tag is ever pushed and nothing publishes.

Nothing recovers it. release-please runs with `skip-github-release: true` and never tags. Every later push re-runs `tag-release`, and every one of them sees a non-release head and no-ops again. Worse, because the version stays untagged, release-please keeps regenerating a Release PR for the same version — now with an **empty** commit, since `main` already carries the version — which `release-pr-policy.ts` correctly rejects for missing its required files. The repository ends up in a stable loop that produces a red PR and no release.

v1.9.3 hit exactly this on 2026-08-14. Three PRs merged inside 28 seconds: `fcdcc60` (#638), then the release commit `b2e551c` (#637) at 02:02:20, then `fc0dcc0` (#635) at 02:02:33. The `tag-release` job evaluated at 02:03:53, 80 seconds after the head had moved off the release commit, and no-opped. `v1.9.3` was pushed by hand to recover, and the duplicate Release PR #639 was closed.

Work intake classification: this changes the release tagging contract and its observable job behavior, so it is OpenSpec-gated.

## What Changes

- `tag-release` resolves the release commit by finding, within a bounded window of recent first-parent branch history, the commit whose title is exactly `chore: release <version>` for the version in `package.json` — instead of requiring that commit to be the branch head. Commits that land after the Release PR merge no longer strand the release.
- CI verification and the tag both move from the branch head to the resolved release commit. The job still refuses to tag a commit whose protected-branch push CI has not succeeded.
- The tag-existence check moves **before** the CI wait. Once `v<version>` exists at the resolved commit, ordinary pushes settle immediately instead of burning the 15-minute CI wait. This keeps the cheap path cheap now that an ordinary push no longer short-circuits on the head check.
- Unchanged: `package.json` remains the sole authority for which version is being released; the exact `chore: release <version>` title match; the fail-closed error when the tag exists at a different commit; `git push` + immediate `release.yml` dispatch; `autorelease: pending` → `autorelease: tagged` relabeling; and `release.yml`'s `on: push: tags` trigger for maintainer-pushed tags.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow` — release tagging MUST locate the release commit for the manifest version within recent branch history rather than requiring it to be the branch head, and MUST verify CI and tag that commit.

## Impact

- `scripts/release/tag-release.ts` — `findNonReleaseHeadReason` and its call sites in `resolveReleaseTagPlan` and `runReleaseTagging`; the sha used for `waitForSuccessfulCi` and `git tag`.
- No workflow file changes: `.github/workflows/release-please.yml` already runs `tag-release` on every protected-branch push, which is what makes recovery on a later push possible.
- `test/tag-release.test.ts` — the head-based scenarios become release-commit-based, plus coverage for the stranded-release recovery and the bounded search.
- No CLI surface, structured output, schema, or persisted state changes.

## Non-Goals

- Serializing merges into `main` or adding a merge queue. The fix makes tagging robust to interleaving rather than forbidding it.
- Changing `release-pr-policy.ts`. Rejecting an empty Release PR is correct; this change removes the condition that produces one.
- Changing how release-please computes versions, or removing `skip-github-release: true`.
- Retroactively tagging historical stranded releases. `v1.9.3` was recovered by hand.
