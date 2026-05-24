## Why

Quantex is still intended to iterate on the `0.x` line, but PR #298 used `feat(agents)!` plus a `BREAKING CHANGE` footer and release-please promoted the next stable release from `0.21.1` to `1.0.0`. Release automation needs explicit pre-major guardrails so `0.x` breaking changes advance the minor line unless maintainers deliberately graduate the project to `1.0.0`.

## What Changes

- Configure stable release-please to bump `0.x` breaking changes to the next minor version instead of `1.0.0`.
- Harden Release PR validation so generated stable Release PRs cannot automatically promote a `0.x` base version to `1.0.0`.
- Add tests for the accidental `0.21.1` to `1.0.0` path and the intended `0.21.1` to `0.22.0` path.
- Update the release-governance and release-workflow contracts for pre-major release behavior.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `release-workflow`: Stable release-please configuration must keep pre-1.0 breaking changes on the `0.x` minor line.
- `release-governance`: Release PR validation must reject generated `0.x` to `1.0.0` promotions unless a future explicit graduation path changes the contract.

## Impact

- `release-please-config.json` - add release-please pre-major bump configuration.
- `scripts/release-pr-policy.js` - reject accidental stable `0.x` to `1.0.0` Release PRs.
- `test/release-pr-policy.test.ts` and `test/pr-governance.test.ts` - cover guardrail behavior and config presence.
- `openspec/changes/guard-premajor-release-bumps/*` - record the durable release contract change.
