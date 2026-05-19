## Why

Quantex currently rejects `quantex install agent-a agent-b` even though users often bootstrap a small set of coding agents together. Supporting explicit multi-agent install improves the lifecycle CLI surface without expanding Quantex into a general workflow orchestration tool.

## What Changes

- Extend `install` so users can pass multiple explicit agent names in one command.
- Keep single-agent install semantics unchanged for one target, including existing human and structured success/error behavior.
- Execute multi-agent installs sequentially and report per-agent outcomes plus a concise batch summary.
- Update machine-readable install output, tests, and README examples to document the expanded CLI surface.
- Do not add `install --all`, stdin-driven batch install, or parallel install orchestration.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: Expand the install lifecycle contract so `install` can process multiple explicit agent targets sequentially while preserving per-agent lifecycle outcomes.
- `product-readme`: Update README examples so install guidance matches the supported multi-agent CLI surface.

## Impact

- Affected files: `src/cli.ts`, `src/commands/install.ts`, structured output/schema definitions, tests under `test/**`, and product README examples.
- No new runtime dependencies, release-flow changes, or background orchestration behavior.
