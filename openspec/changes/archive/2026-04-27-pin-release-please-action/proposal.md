# pin-release-please-action

## Why

After PR #55 merged, the stable Release workflow invoked `googleapis/release-please-action@v4` and failed repeatedly while release-please queried GitHub GraphQL merge history. A local dry run reproduced the failure with the latest release-please package, while `release-please@16.18.0` successfully prepared the expected `chore: release 0.4.0` Release PR.

The release workflow should use a deterministic release-please action version that is known to work for this repository instead of floating to a newer dependency that can break the release path.

## What Changes

- Pin the Release workflow to `googleapis/release-please-action@v4.1.5`, which bundles release-please 16.18.0.
- Split release-please execution into a Release PR phase and a GitHub Release phase.
- Update stable and beta Release PR headers to include the required closure section.
- Document that the Release workflow should not float release-please action versions without verification.

## Impact

- Release PR creation should recover for the Qoder catalog feature merged in PR #55.
- Release PR merges should continue to publish through the existing build, npm trusted publishing, and artifact upload path.
- Generated Release PRs should satisfy PR Governance without manual body edits.
