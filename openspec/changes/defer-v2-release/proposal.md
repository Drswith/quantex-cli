## Why

The generated `2.0.0` Release PR was merged before the required v2 refactor and its 90-day stabilization period. Although no v2 tag, GitHub Release, or npm package was published, future release-please preparation would calculate the same major release again unless the release gate records and enforces the restriction.

## What Changes

- Revert the unsealed `2.0.0` version-candidate files to the published `1.7.1` source version.
- Add deny-by-default Release PR and sealing gates that block stable v2 publication.
- Require a future reviewed OpenSpec change, after the required refactor has merged and its 90-day stabilization window has elapsed, before the v2 gate can be removed.
- Document the emergency withdrawal and the required future activation path.

## Capabilities

### New Capabilities

- `major-release-readiness`: Enforce the explicit refactor-completion and stabilization-window requirement before a deferred major release can be merged or sealed.

### Modified Capabilities

- `release-workflow`: Stable Release PR planning and sealing must reject a deferred major release until its readiness contract is satisfied.
- `release-governance`: Dedicated Release PR validation must reject deferred major versions that have no approved readiness record.

## Impact

Affected areas are the generated release-version files, Release PR policy, seal contract, release-governance configuration and tests, plus the canonical release documentation and OpenSpec contracts. No v2 tag, GitHub Release, npm version, or binary asset is created by this change.
