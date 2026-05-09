## Why

The user-facing `skills/quantex-cli` command reference drifted behind the implemented agent catalog: the skill snapshot omits `deepseek` and `jcode` even though the current CLI and product README expose both. This can mislead external agents that rely on the skill instead of probing the running binary first.

## What Changes

- Update the `skills/quantex-cli` supported-agent snapshot so it includes every currently implemented catalog agent.
- Keep the skill guidance that the running binary remains the source of truth for exact command and output support.
- Add a small product-doc contract delta so the public skill snapshot is kept aligned with the current CLI surface.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `product-readme`: require the user-facing Quantex CLI skill command reference to keep supported-agent snapshots aligned with the current CLI catalog.

## Impact

- `skills/quantex-cli/references/command-recipes.md` - sync the supported-agent snapshot with `quantex capabilities --json`.
- `openspec/changes/sync-quantex-cli-skill-agent-snapshot/specs/product-readme/spec.md` - record the documentation contract delta.
