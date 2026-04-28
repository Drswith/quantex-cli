## Why

Quantex already models Qoder CLI with the correct executable binary `qodercli`, but the batch update flow can still treat a PATH-detected Qoder binary as a managed update target even when Quantex never installed or tracked it. We need to keep the `qoder` agent slug while preventing `update --all` from auto-updating untracked PATH-only agents.

## What Changes

- Change `quantex update --all` so it skips agents that are only detected in `PATH` and are not tracked through Quantex state.
- Keep Qoder CLI lifecycle metadata aligned with the existing `qoder` slug plus `qodercli` executable-binary contract.
- Add tests that verify `qoder` continues to resolve to the `qodercli` binary and untracked PATH-only agents are not auto-updated by `update --all`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: batch update planning skips PATH-only agents that have no recorded Quantex install state.

## Impact

- Affected code: `src/agents/definitions/`, agent registry exports, and tests.
- Affected contracts: batch update behavior for untracked PATH installs and the Qoder slug-to-binary execution contract.
- Dependencies: no new runtime dependency.
