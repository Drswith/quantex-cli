# Proposal: inspect-provider-version-fallback

## Why

When an agent's `--version` probe fails (non-zero exit, crash, or unparseable output), `qtx ls` / `qtx inspect` / `qtx doctor` show `unknown` even though the lifecycle observation already merged the provider-reported package version onto `executable`. The v1 inspection projector currently reads the raw PATH probe (`pathExecutable`) for `installedVersion`, so a knowable version never reaches the CLI.

## What Changes

- Project `installedVersion` from the merged `executable` observation when the PATH executable is present, so a provider-reported version is displayed after a failed `--version` probe.
- Keep `inPath` / `installed` and binary-path fields on PATH presence, so a provider-only version does not mark an agent as installed.
- Add regression coverage for PATH-present + failed version probe + provider present+version across list, inspect, and doctor.
- Do not change public commands, aliases, exit codes, state v2, receipt JSON, `--json` field names, or the published SDK. Structured output MUST NOT expose engine or route.
- Do not start issues #133/#134, cut a release, or edit GitHub workflow YAML / `release-core.yml` / protect-main.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-version-probing`: Failed `--version` probe streams remain non-evidence, but installed-version display SHALL use the provider-reported version when PATH is present and the probe yielded none.

## Impact

- `src/compatibility/agent-inspection.ts` — source `installedVersion` from merged `result.executable` when PATH is present
- Tests under `test/compatibility/` and `test/commands/` for list, inspect, and doctor
- OpenSpec delta only; no published SDK, command catalog, state schema, receipt, or workflow files

## Intake classification

Observable CLI installed-version display for list/inspect/doctor; OpenSpec required.
