## Why

`qtx update` / `qtx update --all` fail-closes Codex CLI with `The recorded update source does not match live provider evidence` even when inspect/doctor still report a bun-managed `@openai/codex` install. The same update path can sit with no output for minutes on non-TTY automation (then SIGINT / exit 11) because batch planning sequentially probes every catalog provider for agents that will be omitted anyway.

## What Changes

- Treat a recorded package/formula provider that still reports the bound package present as matching live source evidence, even when PATH points at a different executable than the lifecycle receipt recorded for the same version (Codex `~/.local/bin` vs bun/npm shim).
- Keep fail-closed behavior when the recorded provider is absent, versions semantically conflict, or the provider itself reports a conflicting live executable path.
- Skip catalog provider probes during `update --all` planning for agents with no PATH executable, no installed-agent state, and no receipt.
- Bound PATH version probes on the update observation path so a hung `codex --version` cannot stall the rest of the batch; treat that probe as an unknown version unless the command-level timeout or cancellation already fired.
- In human mode, emit an initial progress line before batch planning so a TTY session is not silent. Do not change `--json` shape, aliases, exit codes, state v2, or receipts, and do not expose engine/route identifiers.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lifecycle-reconciliation`: receipt executable path is not source-drift evidence for a still-present recorded package/formula provider; script/binary path identity and provider-reported live paths stay compared.
- `agent-update`: update planning keeps the recorded package source in the Codex-style relocation case; `update --all` must remain completable without probing catalog-only absent agents and without stalling the batch on a hung PATH version probe.

## Impact

- `src/core/lifecycle/agent-observation.ts` and its tests
- Update production observation (`src/core/update-production.ts`, `src/services/lifecycle-observations.ts`, `src/commands/update.ts`)
- Version probe budget helper used only on observation/update paths
- Regression tests for Codex source mismatch and catalog-only / hung-probe batch planning
- No public command additions, no published SDK expansion, no YAML / workflow / `release-core.yml` changes

## Intake classification

Observable CLI update behavior and lifecycle source-reconciliation contract; OpenSpec required. Requested by #742.
