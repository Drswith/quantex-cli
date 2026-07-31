## Context

`selectReleaseCandidate` recovers missing npm packages for the latest successful release commit, but once npm integrity is `cli-published` it falls through to Release PR mode or skip. GitHub Release asset upload only runs when mode is `publish`, so asset-only failures are never retried.

The OpenSpec release-workflow contract already requires partial-release retries to verify or publish npm and attach artifacts for the selected immutable release commit. The resolver simply does not inspect remote assets today.

## Goals / Non-Goals

**Goals:**

- Classify GitHub Release asset integrity for the latest release tag using the required binary matrix plus `manifest.json` and `SHA256SUMS.txt`.
- Select `publish` when those assets are incomplete, so rebuild + `gh release upload --clobber` can repair them without republishing an already-present npm package.
- Fail closed when asset inspection is indeterminate, matching npm registry fail-closed behavior.

**Non-Goals:**

- Reordering CI candidates by branch topology / `updated_at` (tracked separately).
- Enforcing dispatch branch allowlist beyond the workflow UI choice control.
- Changing required asset names, binary build matrix, or npm closure rules.
- Backfilling older incomplete releases when a newer release is already fully published.

## Decisions

1. Extend `SelectReleaseCandidateOptions` with per-version GitHub Release asset integrity (`complete` | `incomplete` | `indeterminate` | missing inspection).
2. After the latest release commit passes npm integrity as `cli-published`, check asset integrity before falling through to `pr`/`skip`.
3. Reuse `REQUIRED_RELEASE_ASSET_NAMES` from `src/release-artifacts` and also require `manifest.json` and `SHA256SUMS.txt`.
4. Inspect assets through the GitHub Releases API by tag in `resolveReleaseTargetFromEnvironment`; keep `selectReleaseCandidate` pure and testable.
5. Treat a missing GitHub Release object for an existing tag as incomplete assets (publish to create/upload), not as skip.

## Risks / Trade-offs

- [Asset API flake] -> Fail closed with an explicit indeterminate error rather than skipping recovery.
- [False incomplete from renamed assets] -> Use the same required names the artifact validators already enforce.
- [Publish mode re-enters release-please] -> Existing publish path already skips npm when published and uploads with `--clobber`; keep that contract.

## Migration Plan

No user migration. After merge, the next Release `workflow_dispatch` on a protected branch can recover asset-only gaps for the latest release commit.
