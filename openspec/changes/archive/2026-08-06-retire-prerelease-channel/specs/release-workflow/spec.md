# release-workflow Delta

## REMOVED Requirements

### Requirement: Prereleases SHALL be cut from main and preview the next unreleased version

**Reason**: The stated mechanism does not work and was never exercised before being written down. Merging a commit carrying `Release-As: 1.8.7-beta.1` produced a Release PR for stable `1.8.7`: release-please emits prerelease versions only when its config declares `versioning: prerelease` / `prerelease: true` / `prerelease-type`, which `release-please-config.json` does not. `release:dry-run` verified the publish side and never touched version computation, so the requirement passed validation that could not have caught it.

The channel is also unused. Of 102 published versions, 12 are prereleases and 11 predate 1.0; the 1.x line produced exactly one, `1.8.2-beta`, which was abandoned immediately and is the inversion this workstream has been chasing.

**Migration**: No mechanism replaces it. `main` is the only release line and publishes to `latest`. The npm `beta` dist-tag is retired by a maintainer through `npm dist-tag rm quantex-cli beta`; it is registry state, not repository state.

## ADDED Requirements

### Requirement: A prerelease version SHALL never be published to the latest dist-tag

There is no prerelease channel. If a version carrying a prerelease suffix is ever produced, publication SHALL route it to the `beta` npm dist-tag rather than `latest`, so that a preview build can never displace the current stable release for ordinary installs.

This is a fail-safe rather than a feature: nothing in the repository is expected to produce such a version. It is stated so the version-to-dist-tag derivation in the release identity contract is not removed later as unreachable code.

#### Scenario: Stable release publishes to latest

- **WHEN** a release commit for a version without a prerelease suffix is published
- **THEN** publication MUST use the `latest` npm dist-tag

#### Scenario: A prerelease version is published defensively

- **WHEN** a version carrying a prerelease suffix reaches publication
- **THEN** publication MUST use the `beta` npm dist-tag
- **AND** it MUST NOT be published to `latest`
