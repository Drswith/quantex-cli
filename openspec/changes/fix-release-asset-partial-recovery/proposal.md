## Why

Release target reconciliation currently decides publish vs skip using only tag presence and npm integrity. When `quantex-cli@<version>` is already on npm but the GitHub Release asset matrix is incomplete or missing, a maintainer retry selects `skip`/`pr` and never re-runs `gh release upload --clobber`, leaving binary install and self-upgrade broken while npm looks healthy.

## What Changes

- Inspect existing GitHub Release assets for the latest successful release tag during release-target resolution.
- When npm is already published but required release assets are incomplete or indeterminate, select `publish` for that immutable release commit so artifact rebuild/upload can recover.
- Keep npm-only recovery and “do not backfill older releases” behavior unchanged.
- Add regression coverage for asset-incomplete and asset-indeterminate resolution.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `release-workflow`: clarify that partial-release recovery MUST treat an incomplete or indeterminate GitHub Release asset matrix as publish-worthy even when npm already has `quantex-cli@<version>`.

## Impact

- Affected code: `scripts/release-target-resolution.ts`, `test/release-target-resolution.test.ts`.
- Release workflow YAML upload path already uses `gh release upload --clobber` in publish mode; no workflow rewrite required for the recovery path.
- Work-intake classification: durable release/publishing behavior requires OpenSpec.
