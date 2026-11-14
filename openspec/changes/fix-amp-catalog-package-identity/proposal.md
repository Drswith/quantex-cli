## Why

Default `quantex install amp` records success on Bun while leaving no `amp` executable. The catalog still binds `@sourcegraph/amp`, whose published `bin.amp` points at `node_modules/@ampcode/cli/bin/amp.exe`. Bun's flat global layout does not materialize that nested path, so package presence verifies and the post-mutation observation merges as present, but PATH/`info`/`exec` see no binary.

## What Changes

- Bind Amp's bun and npm catalog candidates to `@ampcode/cli`, the package that ships the `amp` executable.
- Declare `@sourcegraph/amp` as a superseded npm identifier so already-recorded installs are `manual-required` / migrate instead of being updated in place.
- Update the Amp agent-catalog contract to name `@ampcode/cli`.
- Add regression coverage that Amp's current package is `@ampcode/cli` and that `@sourcegraph/amp` is superseded.

**Not changing:** install/verify engine behavior, PATH merge rules, npm 12 `--allow-scripts`, Windows self-upgrade helper parse (#763), or any other catalog agent.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-catalog`: Amp's npm/bun package identity is `@ampcode/cli`; `@sourcegraph/amp` is a superseded identifier.

## Impact

- `src/agents/catalog/amp.json`
- generated catalog artifacts (`src/agents/generated/`, `packages/core/src/generated/`, `docs/generated/agent-provider-support.md`)
- `openspec/specs/agent-catalog/spec.md` (via this change's delta)
- catalog tests in `test/agents.test.ts`

No CLI command surface, schema, Core SDK, YAML, or self-upgrade changes.

## Intake classification

Observable catalog metadata and install-method identity change; OpenSpec required.
