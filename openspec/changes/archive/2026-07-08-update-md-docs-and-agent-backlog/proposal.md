## Why

Active Markdown surfaces have drifted from the current Quantex agent catalog after recent support additions. The product README pages, skill-facing support snapshot, and top-level backlog issue no longer tell the same supported-vs-candidate story, which weakens onboarding and backlog triage.

## What Changes

- Refresh `README.md` and `README.zh-CN.md` so supported-agent references and tables match the current catalog, including Command Code.
- Update active support-tracking docs such as `docs/agent-support-matrix.md`, `docs/github-collaboration.md`, and `skills/quantex-cli/` references so they point at the correct supported-catalog and backlog sources of truth.
- Rewrite GitHub issue `#134` so the candidate ledger and active backlog reflect the currently delivered agent-support work.
- Do not change CLI behavior, schemas, install methods, package metadata, or release workflow behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-memory`: document how active agent-support docs and the top-level backlog issue stay aligned with `src/agents/catalog/*.json` and current catalog-triage policy.

## Impact

- Affected files: active README/docs/skill Markdown surfaces plus the `project-memory` OpenSpec delta for agent-support tracking.
- Affected external surface: GitHub issue `#134`.
- Validation: `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run openspec:validate`, `bun run memory:check`, and the Quantex CLI skill smoke check.
