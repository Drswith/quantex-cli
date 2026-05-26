## Why

Work intake classification: this changes supported agent catalog metadata, install metadata, version probing, exports, and product-facing docs, so it requires an OpenSpec-backed change.

DeepSeek TUI has renamed upstream to CodeWhale at `https://github.com/Hmbown/CodeWhale`, but Quantex still exposes the old catalog name and lifecycle metadata. A prior rename attempt used major-release conventional-commit markers and was rolled back after an abnormal `1.x` release path, so this change re-delivers the catalog rename from current `main` while keeping release automation inputs on the pre-1.0 minor line.

## What Changes

- Rename the supported lifecycle catalog entry from DeepSeek TUI to CodeWhale.
- Move the canonical catalog name, executable, npm package, Cargo package, version probe, and self-update command to CodeWhale's current upstream names.
- Remove old `deepseek` and `deepseek-tui` lookup compatibility by design.
- Update generated exports, tests, product README tables, and the Quantex command recipe snapshot.
- Do not change `package.json` versions, release manifests, tags, release artifacts, or publishing workflow behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-catalog`: replace the DeepSeek TUI lifecycle entry with CodeWhale's current lifecycle surface.

## Impact

- Issue: `#306`
- Affected catalog files: `src/agents/catalog/`, generated catalog files, `src/agents/index.ts`, and `src/index.ts`.
- Affected validation: catalog tests, root export tests, OpenSpec validation, and standard lint/type/test checks.
- Release guardrail: implementation commits and PR title must avoid conventional-commit major release markers; PR release intent must be pre-1.0 minor, not major.
