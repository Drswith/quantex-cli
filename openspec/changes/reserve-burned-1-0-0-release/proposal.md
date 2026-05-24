## Why

`quantex-cli@1.0.0` was accidentally published during the pre-1.0 line, then deprecated after npm refused unpublish because registry dependents already existed. That exact version is now permanently occupied, so future stable release automation must not generate or publish `1.0.0` again.

## What Changes

- Configure stable release-please to keep pre-1.0 breaking changes on the zero-major minor line.
- Extend Release PR validation so generated stable Release PRs are rejected when they propose `1.0.0`.
- Keep the existing pre-major graduation guard explicit: a `0.x` base version must not be promoted directly to `1.0.0` without a future dedicated graduation contract.
- Record `1.0.0` as a burned stable release version in OpenSpec.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `release-governance`: generated Release PR validation rejects burned stable versions and accidental pre-major graduation.
- `release-workflow`: stable release planning keeps pre-major breaking changes on the zero-major line and treats `1.0.0` as unavailable for future publication.

## Impact

- `release-please-config.json`
- `scripts/release-pr-policy.js`
- `test/release-pr-policy.test.ts`
- `test/pr-governance.test.ts`
- `openspec/specs/release-governance/spec.md`
- `openspec/specs/release-workflow/spec.md`
