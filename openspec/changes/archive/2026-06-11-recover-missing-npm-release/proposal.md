## Why

Release `v0.23.5` reached GitHub Releases, but npm publication failed before `quantex-cli@0.23.5` was published. Later Release workflow runs saw the GitHub release/tag and treated the release commit as already published, leaving npm `latest` on `0.23.4`.

## What Changes

- Teach release-target resolution to inspect npm package publication state for release commits.
- Keep publish mode active when the latest release commit's GitHub release/tag exists but the matching npm package version is missing.
- Drive publish follow-up steps from the resolver target SHA/tag so reruns can rebuild, publish npm, and upload artifacts for an existing GitHub Release.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `release-workflow`: recover partial latest release publication when GitHub Release exists but npm package publication is missing.

## Impact

- Affected code: `scripts/release-target-resolution.ts`, `.github/workflows/release.yml`, `test/release-target-resolution.test.ts`, `openspec/specs/release-workflow/spec.md`.
- No CLI runtime behavior, command schema, or package contents change.
