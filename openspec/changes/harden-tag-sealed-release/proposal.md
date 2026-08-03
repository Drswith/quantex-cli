## Why

The current release workflow infers publish candidates from successful CI history and merged Release PRs, while pre-merge governance can allow release-bot metadata that protected-branch CI later rejects. A partial recovery can therefore leave multiple same-version Release PRs, publish npm before GitHub Release assets are durable, and rebuild artifacts after validation instead of publishing the exact validated candidate.

## What Changes

- **BREAKING (maintainer workflow):** split release preparation, tag sealing, and publication into explicit workflows instead of using one branch-reconciliation dispatch for both PR creation and publishing.
- Require generated Release PRs to contain one maintainer-authored commit before merge; trusted bot authorship no longer bypasses squash-trailer risk governance.
- Seal a release only from the exact protected-branch head after that SHA has successful push CI, then create the immutable `v<version>` tag and explicitly dispatch publication at that tag.
- Make the publish workflow tag-only and validate that the tag, package version, release commit title, protected branch, npm channel, and successful CI SHA agree before any mutation.
- Build the npm tarball, standalone binaries, manifest, and checksums once; upload one release-candidate artifact and make publication consume those exact files without rebuilding.
- Stage or recover the GitHub Release and verify uploaded assets before npm publication; publish the exact tarball, verify npm closure, then make the GitHub Release public.
- Preserve idempotent recovery for existing tags, draft or published GitHub Releases, already-published npm versions, and incomplete assets.
- Document the new maintainer and agent release sequence and its failure-recovery boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: replace history-inferred publication with explicit preparation, protected-branch sealing, and immutable tag publication.
- `release-governance`: make Release PR commit topology safe under the same no-co-author policy enforced after merge.
- `package-distribution`: require npm and standalone release publication to consume the exact validated release-candidate artifact.

## Impact

- GitHub Actions: `.github/workflows/prepare-release.yml`, `.github/workflows/seal-release.yml`, and `.github/workflows/release.yml`.
- Release scripts and tests for tag/commit/branch/CI validation, release-note extraction, npm candidate packing, and closure checks.
- Release governance policy, workflow-classification tests, package-distribution tests, and release target resolution code that no longer owns publication selection.
- `docs/releases.md` and `skills/quantex-agent-runtime/SKILL.md` maintainer/agent guidance.
- No CLI command, state schema, agent lifecycle behavior, or public package API changes.
