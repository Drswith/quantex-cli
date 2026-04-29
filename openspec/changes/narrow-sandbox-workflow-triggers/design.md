# Design: Narrow sandbox workflow push triggers

## Approach

Use GitHub Actions `paths` filtering on the existing `push` trigger for `main` and `beta`.

The include list should cover files that can affect sandbox lifecycle behavior:

- `.github/workflows/sandbox-tests.yml`
- `package.json` and `bun.lock`
- `scripts/lifecycle-smoke.ts`
- `scripts/test-container.ts`
- `scripts/test-sandbox.ts`
- `src/agents/**`
- `src/agent-update/**`
- `src/commands/**`
- `src/config/**`
- `src/inspection/**`
- `src/package-manager/**`
- `src/self/**`
- `src/state/**`
- `src/testing/**`
- `src/utils/**`
- relevant tests for sandbox and lifecycle helpers

Documentation and OpenSpec-only archive changes are intentionally excluded from automatic push-triggered sandbox runs. Maintainers can still run the workflow manually when a process-only change needs remote validation.

## Tradeoffs

Path filtering is simpler than calling the repository taxonomy from inside the workflow, and it prevents docs-only pushes from starting a Modal job before any repository code executes. The tradeoff is that the workflow carries a narrow path list. This is acceptable here because the sandbox workflow is an optional maintainer validation layer, not a merge-gating classification authority.
