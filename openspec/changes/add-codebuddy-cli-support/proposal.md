## Why

CodeBuddy Code is an officially documented AI coding CLI with stable install, version, and update commands, but Quantex does not yet recognize it as a supported lifecycle agent. Users who install CodeBuddy today cannot use `quantex install codebuddy`, `quantex inspect codebuddy`, or `quantex update codebuddy` through the same catalog contract as the rest of the supported agent set.

## What Changes

- Add a CodeBuddy agent definition with lifecycle metadata: canonical slug, lookup alias, homepage, npm package metadata, binary name, install methods, version probe, and self-update command.
- Register CodeBuddy through the built-in agent catalog and root exports so existing lookup, install, ensure, inspect, resolve, exec, and update surfaces can use it.
- Update the agent-catalog OpenSpec contract and the static supported-agent README tables so product-facing references match the expanded CLI surface.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `agent-catalog`: Add CodeBuddy Code as a supported lifecycle agent with verified install, version-probe, lookup, and update metadata.

## Impact

- `src/agents/definitions/codebuddy.ts` — new lifecycle metadata definition
- `src/agents/index.ts` — register import, array entry, and re-export
- `src/index.ts` — re-export the built-in CodeBuddy definition from the root surface
- `test/agents.test.ts`, `test/index.test.ts` — registry and export coverage
- `openspec/specs/agent-catalog/spec.md` — add the CodeBuddy requirement
- `README.md`, `README.zh-CN.md` — keep static supported-agent tables aligned with the current CLI surface
