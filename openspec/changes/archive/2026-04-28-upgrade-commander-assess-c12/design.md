## Context

Quantex documents user configuration as `~/.quantex/config.json`, and the command tests read and write that exact file. Despite that, `src/config/index.ts` currently routes loading through `c12`, which brings support for additional config formats, extends chains, RC files, and runtime loading helpers that Quantex neither documents nor tests.

Separately, the CLI uses `commander@13.1.0`, while upstream `commander` has a stable `14.0.3` release. Upstream documents that Commander 14 requires Node 20+, and Quantex's current local/runtime toolchain already uses Node 22.22.2 and Bun 1.3.9, with CI and release automation on modern Node as well.

## Goals / Non-Goals

**Goals:**

- Move `commander` to the latest stable v14 release without changing Quantex's intended CLI behavior.
- Remove `c12` and its config-loading surface area when Quantex only needs a JSON file loader plus normalization.
- Codify the documented config contract in OpenSpec and tests so future changes are explicit.

**Non-Goals:**

- Expanding config support to YAML, TOML, RC files, or `extends`
- Refactoring the CLI command catalog beyond compatibility changes required by the dependency upgrade
- Changing user-facing config keys or their normalization rules

## Decisions

### Upgrade Commander to 14.0.3

Use the current stable Commander 14 release because it is the latest supported upstream line before the upcoming Commander 15 ESM-only transition. Quantex is already ESM and runs on Bun/modern Node, so the Node 20 support floor does not conflict with current repository expectations.

Alternative considered:

- Stay on Commander 13: lower churn, but no clear compatibility benefit given the current runtime floor.
- Jump to Commander 15 prerelease: unnecessary risk for no immediate user benefit.

### Replace c12 with a direct JSON loader

Implement config loading directly in `src/config/index.ts` using `readFile`, `JSON.parse`, and the existing normalization logic. This matches the documented `~/.quantex/config.json` contract and removes unused support for extra config formats and dynamic loaders.

Alternative considered:

- Keep `c12`: simplest short-term path, but it keeps extra dependency weight and a broader implicit config surface than Quantex intends to support.

### Add config-file regression coverage

Update tests so they verify loading from an actual `config.json` file instead of mocking `c12`. This makes the new config surface explicit and catches future drift if the loader changes again.

## Risks / Trade-offs

- [Users may have relied on undocumented non-JSON config formats through c12] -> Quantex docs and tests already point only to `~/.quantex/config.json`; codify that contract in OpenSpec and keep normalization behavior unchanged.
- [Commander 14 could expose CLI parsing differences] -> run the full existing CLI and contract test suite after upgrading.
- [Removing c12 changes error behavior for malformed config files] -> preserve a forgiving fallback to `defaultConfig` when the file is missing or unparsable.
