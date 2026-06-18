## Why

Google has introduced Antigravity CLI as the terminal surface for its Antigravity agent platform, with `agy` as the executable and official installers for macOS, Linux, and Windows. Quantex should be able to discover, install, inspect, execute, and update this CLI through the existing supported-agent lifecycle catalog.

## What Changes

- Add Google Antigravity CLI as a supported lifecycle agent with canonical lookup metadata.
- Register `agy` as the executable binary and expose common lookup aliases for user-facing resolution.
- Add official script installer methods for macOS, Linux, and Windows.
- Add version probing via `agy --version` and self-update planning via `agy update`.
- Add focused tests and regenerate the checked-in catalog manifest.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-catalog`: Add Antigravity CLI as a supported agent entry with lifecycle-focused metadata and install/update/version-probe coverage.

## Impact

- Affected catalog data: `src/agents/catalog/`.
- Affected generated catalog manifest: `src/agents/generated/`.
- Affected exports and tests: `src/agents/index.ts`, `test/agents.test.ts`.
- Affected OpenSpec contract: `openspec/specs/agent-catalog/spec.md` via this change delta.
