## Why

After a docs/process-only merge, the `Release` workflow still invoked release-please and failed on a GitHub GraphQL query even though no release was possible. Non-release pushes should exit successfully before release-please so process-only merges do not leave main red.

Work-intake classification: this changes release workflow behavior, so OpenSpec is required before implementation.

## What Changes

- Add a release relevance check before creating the release bot token or running release-please.
- Run release-please only for manual dispatch, release PR merges, release-worthy conventional commit messages, or explicit breaking-change metadata.
- Treat docs/process/archive-only pushes as successful no-release runs.
- Keep release artifact build and publish steps gated on `release_created`.

## Capabilities

### New Capabilities

- `release-workflow`: Defines when the Release workflow should invoke release-please and publishing steps.

### Modified Capabilities

- None.

## Impact

- Affected files: `.github/workflows/release.yml` and OpenSpec artifacts.
- No runtime CLI behavior or package dependency changes.
