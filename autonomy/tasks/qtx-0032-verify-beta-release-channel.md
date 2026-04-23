---
id: qtx-0032
title: Verify beta release channel
status: done
priority: high
area: release
depends_on:
  - qtx-0030
  - qtx-0031
human_review: required
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - release-please-config.beta.json
  - .github/workflows/release.yml
---

# Task: Verify beta release channel

## Goal

The release system should publish beta prereleases from a dedicated `beta` branch without changing the stable `main` release path.

## Context

Stable release publication has been tested with release-please, npm trusted publishing, GitHub Releases, binary artifacts, and smoke checks. The remaining gap is proving that prerelease versions such as `0.3.0-beta.1` can be prepared, published, and installed through the npm `beta` dist-tag.

## Constraints

- Keep `main` publishing stable releases with the npm `latest` dist-tag.
- Publish beta versions only from the `beta` branch.
- Use release-please Release PRs so `package.json`, `.release-please-manifest.json`, generated build metadata, and changelog entries stay source-controlled.
- Treat the beta publish as a real prerelease, not a dry run.

## Implementation Notes

- GitHub issue: https://github.com/Drswith/quantex-cli/issues/21
- Add a beta release-please manifest config with `versioning: prerelease`, `prerelease: true`, and `prerelease-type: beta`.
- Route the Release workflow by branch so `main` uses stable config and `beta` uses beta config.
- Ensure CI runs for `beta` pushes and PRs.
- After merging the workflow support, create a real beta-targeted change and merge the resulting beta Release PR.

## Done When

- A PR lands the beta release-channel automation.
- A `beta` branch exists with the release workflow support.
- Merging a conventional commit into `beta` creates a beta Release PR.
- Merging the beta Release PR publishes the beta package with npm dist-tag `beta` and GitHub prerelease metadata.

## Verification Notes

- Beta channel automation PR: https://github.com/Drswith/quantex-cli/pull/22
- Beta prerelease versioning fix PR: https://github.com/Drswith/quantex-cli/pull/25
- Closed incorrect beta Release PR: https://github.com/Drswith/quantex-cli/pull/24 proposed `0.3.0` before `versioning: prerelease` was enabled.
- Beta Release PR: https://github.com/Drswith/quantex-cli/pull/26
- Beta release workflow: https://github.com/Drswith/quantex-cli/actions/runs/24845768393
- GitHub prerelease: https://github.com/Drswith/quantex-cli/releases/tag/v0.3.0-beta
- npm official registry dist-tags after publication: `latest` remains `0.2.1`; `beta` points to `0.3.0-beta`.
- GitHub prerelease assets include `manifest.json`, `SHA256SUMS.txt`, and all five platform binaries.

## Non-Goals

- Changing the stable release cadence.
- Publishing alpha or release-candidate channels.
