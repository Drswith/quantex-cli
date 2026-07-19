## Why

Work intake classification: this fixes observable `update` behavior, structured batch outcomes, lifecycle source selection, and stale state diagnostics, so it requires an OpenSpec-backed change.

The lifecycle update integration introduced regressions where `update --all` reports never-installed catalog entries as failures, tracked script installs ignore declared self-update commands, and stale install records are presented as provider failures. These outcomes make a healthy update run fail and contradict the existing agent-update contract.

## What Changes

- Exclude catalog-only absent agents from batch update results even when an unavailable candidate provider makes observation inconclusive.
- Route tracked script or binary installs through their declared self-update command without rewriting their recorded install source.
- Treat conclusively absent tracked agents as stale lifecycle evidence instead of update execution failures, with an explicit reconciliation hint.
- Project the same lifecycle planning outcome consistently for single-agent and batch updates.
- Keep untracked executables such as PATH-only agents non-mutating and manual-required.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-update`: clarify batch eligibility, self-update execution and verification, stale-state outcomes, and single/batch projection consistency.

## Impact

- Affected update planning and execution: `src/services/lifecycle-updates.ts` and `src/services/lifecycle-updates-production.ts`.
- Affected command projection: `src/commands/update.ts`.
- Affected tests and v1 compatibility fixtures for lifecycle update behavior.
- No new dependency, command, configuration key, or workflow-orchestration surface.
