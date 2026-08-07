## Why

Quantex supports many agents and install providers, but exercising every real installer on a developer workstation is unsafe and running the complete remote suite for every edit is too slow. The current isolated smoke flow also did not assert the installed version surfaced by inspection, so a real Pi regression could pass while `qtx ls` reported `unknown`.

This implementation request is classified as a durable test and CI workflow change and therefore requires an OpenSpec contract before code or workflow edits.

## What Changes

- Add a deterministic canary-matrix resolver with a quick scope for pull requests and a full scope for scheduled or manually dispatched runs.
- Add a focused lifecycle-smoke `probe` scenario that installs a selected agent in a disposable HOME, verifies inspection and list version evidence, and cleans up the installation.
- Make the version probe read stderr when a successful agent emits no stdout, with regression coverage for both the legacy and Core observation paths.
- Run the quick canary matrix on relevant pull requests and the full catalog matrix on a schedule or manual dispatch using fresh GitHub-hosted runners; keep Modal/Docker for explicit isolation transport validation.
- Align path taxonomy, workflow tests, and the isolation runbook with the new split between fast real canaries and slower broad isolation runs.

## Capabilities

### New Capabilities

- `agent-canary-validation`: Disposable real-agent canary selection, lifecycle probe assertions, and CI scheduling/transport rules.

### Modified Capabilities

- None. Existing Modal/Docker isolation behavior remains available; the new canary capability adds a separate validation layer.

## Impact

- Affected code: `scripts/smoke/lifecycle-smoke.ts`, `scripts/ci/agent-canary-matrix.ts`, version observation code, and focused Vitest coverage.
- Affected workflow: a new GitHub Actions canary workflow and path-taxonomy/test fixtures.
- Affected documentation: the Modal sandbox runbook and contributor-facing validation guidance.
- No product CLI flags, persisted state formats, or agent catalog entries are changed.
