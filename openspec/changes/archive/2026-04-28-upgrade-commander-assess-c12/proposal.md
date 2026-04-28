## Why

Quantex currently depends on `commander@13.1.0` for the CLI surface and `c12` for config loading. `commander` has a newer stable line compatible with the repository's current Node 22 and Bun 1.3 runtime, while `c12` provides a much broader config system than Quantex actually documents or tests today.

## What Changes

- Upgrade `commander` to the current stable v14 line after validating the Quantex CLI surface against its Node 20+ support floor.
- Replace the current `c12`-backed config loader with a repo-native JSON loader that matches Quantex's documented `~/.quantex/config.json` contract.
- Add regression coverage for loading and normalizing config directly from `config.json`.

## Capabilities

### New Capabilities

- `config-surface`: defines the supported on-disk user config format and normalization behavior for Quantex.

### Modified Capabilities

- None.

## Impact

- `package.json` and `bun.lock`
- `src/cli.ts` dependency compatibility via `commander`
- `src/config/` implementation and config-related tests
- OpenSpec specs for the documented config contract
