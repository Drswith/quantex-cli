## Why

MiMoCode is now a public AI coding agent with an official GitHub repository, install script, and npm package. Quantex should make it discoverable and manageable through the same lifecycle catalog surface as other supported coding agents.

## What Changes

- Add MiMoCode to the supported agent catalog as canonical agent `mimo`.
- Expose lookup aliases for common upstream naming variants: `mimocode` and `mimo-code`.
- Record the official npm package metadata (`@mimo-ai/cli`), executable binary (`mimo`), install methods, and version probe.
- Avoid inventing unsupported lifecycle metadata, including Bun install methods or a dedicated self-update command that upstream docs do not document.
- Add focused catalog tests and OpenSpec coverage for the new lifecycle contract.

## Capabilities

### New Capabilities

### Modified Capabilities

- `agent-catalog`: Add MiMoCode as a supported lifecycle agent.

## Impact

- `src/agents/catalog/` and generated catalog exports gain a new MiMoCode entry.
- `src/agents/index.ts` and `src/index.ts` re-export the new catalog agent.
- `test/agents.test.ts` and `test/index.test.ts` cover lookup, metadata, install methods, and exports.
- `openspec/specs/agent-catalog/spec.md` gains the accepted MiMoCode lifecycle requirement.
