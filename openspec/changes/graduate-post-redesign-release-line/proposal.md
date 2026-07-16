## Why

The lifecycle redesign and its archive closure are complete, but the stable package still reports `0.29.1`. Quantex needs one explicit, reviewable release-line graduation so `0.29.1` remains the final 0.x baseline and the redesigned product starts at `1.1.0` without reusing the burned `1.0.0` version.

## What Changes

- **BREAKING**: Graduate the stable release line exactly once from `0.29.1` to `1.1.0`.
- Treat `0.29.1` as the final publishable 0.x version; reject later 0.x stable Release PRs.
- Keep `1.0.0` burned and reject any pre-major-to-major graduation except the exact `0.29.1 -> 1.1.0` transition.
- Use release-please's official one-shot `Release-As: 1.1.0` commit footer so the protected workflow generates the normal Release PR instead of manually editing version files.
- After `1.1.0`, resume ordinary SemVer planning on the 1.x line; the one-shot override MUST NOT become permanent release configuration.
- Deliver the graduation through normal CI, Ready PR review, manual rebase-first merge, generated Release PR review, publication validation, and agent-driven OpenSpec archive closure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-workflow`: Replace the indefinite pre-major hold with the exact post-redesign graduation contract, guard the final 0.x boundary, and retain ordinary protected release-please publication after the one-shot transition.

## Impact

- Affected repository surfaces: stable release-please configuration, Release PR policy and focused tests, release runbooks/collaboration guidance, and the merge commit metadata that triggers the generated `1.1.0` Release PR.
- Affected external systems: the normal `main` Release workflow, GitHub Release `v1.1.0`, npm `quantex-cli@1.1.0`, and release binary artifacts.
- No CLI command, package name, binary name, stable v1 machine protocol, runtime dependency, or lifecycle implementation behavior changes.
