## Why

Quantex supports many agents and install providers, but exercising every real installer on a developer workstation is unsafe and running the complete remote suite for every edit is too slow. The current isolated smoke flow also did not assert the installed version surfaced by inspection, so a real Pi regression could pass while `qtx ls` reported `unknown`.

This implementation request is classified as a durable test and CI workflow change and therefore requires an OpenSpec contract before code or workflow edits.

## What Changes

- Add a deterministic canary-matrix resolver with a quick scope for pull requests and a full scope for scheduled or manually dispatched runs. The full selector prefers only CI-ready providers that the existing product configuration can actually select, otherwise retains catalog order, and carries explicit unsupported-runner reasons instead of discovering known TTY, login, or installer-process limitations as red jobs.
- Add a focused lifecycle-smoke `probe` scenario that installs a selected agent in a disposable HOME, verifies inspection and list version evidence, and cleans up the installation.
- Make the version probe read stderr when a successful agent emits no stdout, with regression coverage for both the legacy and Core observation paths.
- Run the quick canary matrix on relevant pull requests and the full catalog matrix on a schedule or manual dispatch using fresh GitHub-hosted runners. Provision the provider toolchain selected by the matrix, use a canary Bun version that satisfies current real-agent engine requirements, and keep Modal/Docker for explicit isolation transport validation.
- Align cleanup assertions with provider capabilities: managed providers must remove their executable, while install-only script providers must clear Quantex tracking and rely on destruction of the disposable runner for physical cleanup. A reviewed, typed post-uninstall source conflict remains distinct from a pass and is reported as a cleanup-stage skip. Preserve the in-flight agent for best-effort cleanup when any assertion fails.
- Treat uv's successful `No tools installed` result as conclusive package absence in both legacy and Core observation, while keeping unexplained empty output indeterminate.
- Align path taxonomy, workflow tests, and the isolation runbook with the new split between fast real canaries and slower broad isolation runs.

## Capabilities

### New Capabilities

- `agent-canary-validation`: Disposable real-agent canary selection, lifecycle probe assertions, and CI scheduling/transport rules.

### Modified Capabilities

- `agent-update`: Align legacy and Core uv package-presence observation for a successful empty tool inventory.

## Impact

- Affected code: `scripts/smoke/lifecycle-smoke.ts`, `scripts/ci/agent-canary-matrix.ts`, version and uv package-presence observation code, and focused Vitest coverage.
- Affected workflow: a new GitHub Actions canary workflow and path-taxonomy/test fixtures.
- Affected documentation: the Modal sandbox runbook and contributor-facing validation guidance.
- No product CLI flags, persisted state formats, or agent catalog entries are changed.
