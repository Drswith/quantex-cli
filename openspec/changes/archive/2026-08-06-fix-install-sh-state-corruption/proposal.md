## Why

The public `install.sh` bootstrap records `self.installSource = "binary"` by rewriting `~/.quantex/state.json` with a non-atomic truncate-write, and on JSON parse failure it substitutes empty default state. That can wipe recorded `installedAgents` / `lifecycleReceipts` or leave torn JSON, violating the existing `quantex-state` fail-closed and atomic-write contracts.

## What Changes

- Make `install.sh` fail closed when an existing `state.json` cannot be parsed or is not a safe object shape: leave the file untouched and continue the binary install.
- Make successful `install.sh` state updates write through a temporary file and atomic rename.
- Preserve existing installed-agent and receipt evidence when only recording the binary install source.
- Add a static regression test that locks the fail-closed and atomic-write shape in `install.sh`.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `quantex-state`: Extend the fail-closed and atomic-write requirements so public bootstrap installers that mutate `state.json` obey the same safety contract as the CLI.

## Impact

- Affected files: `install.sh`, `openspec/specs/quantex-state/spec.md` (via delta), `test/install-scripts.test.ts`
- Work-intake classification: configuration/state mutation safety for a product-facing installer — OpenSpec required
- Non-goals: Windows `install.ps1` state recording (it does not write state today), Core staged install/ensure, release workflow changes
