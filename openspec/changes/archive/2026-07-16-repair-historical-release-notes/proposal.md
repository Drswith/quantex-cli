## Why

The generated `v0.29.1` and `v1.1.0` release notes omit the lifecycle redesign delivered after `v0.29.0`. The latter also exposes a release-line graduation marker as a public breaking change even though the redesign preserved the documented v1 CLI and machine-readable contracts. Users therefore cannot determine the upgrade impact from either the repository changelog or the published GitHub Release pages.

## What Changes

- Add a curated historical summary of the post-`v0.29.0` lifecycle redesign and its compatibility boundary to the existing `v0.29.1` and `v1.1.0` changelog sections.
- Update the already-published `v0.29.1` and `v1.1.0` GitHub Release bodies to match those corrected historical notes.
- Preserve generated commit entries, tags, package versions, release-please configuration, resolver behavior, and publication workflows unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: record the one-time correction of the published release-note copies without changing release planning or publication behavior.

## Impact

- Affected repository artifact: `CHANGELOG.md`.
- Affected external presentation: GitHub Release pages for `v0.29.1` and `v1.1.0`.
- No CLI, package, binary, tag, npm, release-please, resolver, or workflow behavior changes.
