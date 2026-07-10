## Why

Ghost uninstall recovery was hardened for npm, bun, mise, and uv, but Homebrew-managed installs still lack presence probing. When a brew-installed agent is removed outside Quantex, `quantex uninstall` fails and leaves permanent ghost state that breaks later lifecycle commands.

## What Changes

- Add Homebrew package presence probing with `present`, `absent`, and `unknown` outcomes.
- Wire brew `probePackagePresence` into managed ghost uninstall recovery.
- Add regression tests for confirmed absence, still-present, and inconclusive brew probe paths.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: ghost uninstall recovery must confirm brew package absence before clearing state and must fail closed when brew presence probing is inconclusive.

## Impact

- Affected code: `src/package-manager/brew.ts`, `src/package-manager/installers.ts`, related tests.
- No CLI flags, schema version, or command catalog changes.
