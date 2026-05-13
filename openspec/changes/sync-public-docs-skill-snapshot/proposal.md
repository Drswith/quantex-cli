## Why

The current public Quantex CLI skill snapshot is behind the live agent catalog: `capabilities --json` reports `reasonix` and `vtcode`, while `skills/quantex-cli/references/command-recipes.md` omits both. The Simplified Chinese README also lags behind the English maintainer command list for isolation smoke validation.

This request requires OpenSpec because it updates product-facing documentation and the maintained user-facing skill surface.

## What Changes

- Refresh the public skill command recipes supported-agent snapshot so it matches the current CLI catalog.
- Sync the Simplified Chinese README maintainer command list with the English README for `test:container` and `test:sandbox`.
- Keep the user-facing `skills/quantex-cli` and contributor-facing `skills/quantex-agent-runtime` boundary unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `product-readme`: keep README language variants aligned for current maintainer validation guidance.
- `project-memory`: keep the public Quantex CLI skill snapshot aligned with the live CLI catalog when it mirrors supported agents.

## Impact

- `README.zh-CN.md` - sync maintainer validation commands and isolation smoke wording.
- `skills/quantex-cli/references/command-recipes.md` - add missing supported-agent names from the live catalog.
- `openspec/changes/sync-public-docs-skill-snapshot/` - record the documentation and skill-snapshot contract delta.
