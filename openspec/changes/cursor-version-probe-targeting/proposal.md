## Why

`qtx ls` and `qtx inspect cursor` sometimes report a version from an unrelated `agent` binary on `PATH`. Cursor CLI's catalog identity uses `binaryName: agent` and probes `agent --version`, so the first `agent` wins even when Quantex has already resolved, or can resolve, the actual Cursor executable. Closed PR #714 tried to dodge the collision by renaming the catalog binary and adding `cursor` as an alias; that failed golden and identity tests. The version field must come from the Cursor executable Quantex resolved, without catalog identity churn.

## What Changes

- Keep Cursor's catalog identity unchanged: canonical name `cursor`, `binaryName` `agent`, lookup aliases `["agent"]` (aliases MUST NOT include the canonical name).
- Teach version-probe targeting to locate Cursor through a more specific executable name (`cursor-agent`) before falling back to `agent`, then probe the resolved absolute path.
- Do not widen CLI `--json` fields, exit codes, or list/inspect contract shapes.
- Do not rename slugs, expand commands/SDK, or touch self-upgrade / release-core / protect-main paths.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-version-probing`: Installed-version evidence for an observed agent MUST come from the executable Quantex resolved for that agent, not from a bare `PATH` name that can collide.
- `agent-catalog`: Cursor CLI keeps `binaryName` `agent` and alias `agent`, and declares a preferred probe executable `cursor-agent` used only to locate the binary.
- `lifecycle-reconciliation`: Observation already substitutes a resolved path into probes whose first argument is the agent's executable name; add the PATH-collision case where a preferred, more specific executable is resolved first.

## Impact

- `src/agents/catalog/cursor.json` and generated catalog/core catalog projections
- `src/agents/types.ts`, `src/agents/schema.ts`, generated `catalog.schema.json`
- `src/core/production-observation.ts` (list/inspect observation)
- `src/utils/executable-resolution.ts`, `src/utils/executable-search-paths.ts`
- `src/services/lifecycle-observations.ts`, `src/inspection/agents.ts`, `src/core/update-production.ts` (same targeting rule)
- `test/agents.test.ts`, `test/core/production-observation.test.ts`, `test/utils/executable-resolution.test.ts`
- OpenSpec deltas under this change

No CLI command catalog, schema-version, or `--json` field changes. Launch argv already uses the observed executable path, so correcting observation also aims execution at that same binary without changing the execution executor.

## Intake classification

Observable CLI version-probe / agent-catalog behavior change; OpenSpec required.
