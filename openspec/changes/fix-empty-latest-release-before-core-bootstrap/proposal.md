## Why

The first Core-era release (`v1.2.0`) created a public GitHub Release before the Core npm bootstrap gate ran. When `@quantex/core` trusted publishing was not ready, the workflow failed and skipped npm publish plus binary upload, leaving `releases/latest` as an empty tag. Stable binary self-upgrade reads `releases/latest/download/manifest.json`, so standalone upgrades currently fail artifact discovery.

## What Changes

- Require Core npm bootstrap validation to fail closed **before** Release Please creates or refreshes the public GitHub Release when `core_required` is true.
- Keep the existing rule that neither repository-owned npm package is published until Core bootstrap is ready.
- Keep uploading standalone binaries only after repository npm closure.
- Add a workflow-structure regression test that the bootstrap gate precedes the GitHub Release step.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `release-workflow`: Core bootstrap incompleteness must block public GitHub Release creation, not only npm publish.
- `self-upgrade`: no requirement change in this slice; binary clients still consume `releases/latest`, so preventing empty latest releases remains the primary fix.

## Impact

- `.github/workflows/release.yml` step order and the early Core bootstrap check
- `test/release-target-resolution.test.ts` workflow-structure assertions
- `docs/releases.md` operator guidance for the bootstrap-before-release ordering
- Live `v1.2.0` recovery remains a maintainer owner (bootstrap Core or replace the empty release assets); this change prevents recurrence

## Work-intake classification

Release-workflow correctness and product-facing release guidance change → OpenSpec required before implementation.
