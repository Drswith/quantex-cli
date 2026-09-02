## Why

Quantex 1.12's first slice moved CLI `install` / `ensure` / `update` / `uninstall` / `list` onto in-repo Core. The remaining read observation commands `inspect`, `info`, and `resolve` already call Core read ports through `resolveCliReadObservation`, but they are not yet contracted as thin CLI facades for this minor. This second slice locks that ownership without expanding the published `quantex-core` SDK or reshaping frozen CLI JSON contracts.

Work-intake classification: observable CLI behavior, architecture boundaries, and product-facing Core transition docs. OpenSpec required before edits.

## What Changes

- Treat CLI `inspect`, `info`, and `resolve` as thin facades over in-repo Core read observation (the same ports path `list` already uses), projecting richer v1 CLI payloads rather than wrapping public SDK `inspect()` / `list()` descriptors into a second CLI-shaped API.
- Keep command modules presentation-focused: observe through Core, project into frozen human/JSON/NDJSON contracts, apply exit policy.
- Do **not** expand the published `quantex-core` public API (`createQuantex` surface).
- Do **not** change `release-core.yml`, independently publish Core, or add commands/aliases.
- Freeze package identity (`quantex-cli`), binaries (`qtx` / `quantex`), state schema version 2, command names/aliases, `--json` / `--output`, exit codes, and v1 root exports.
- Update compatibility, runtime-boundary, and product-readme contracts so 1.12 correctly describes Core-backed CLI read observation without implying an SDK expansion.
- Out of scope: `exec` / shortcut-run, upgrade / self-upgrade, config, doctor, capabilities, commands, schema, catalog additions, Core npm publish.

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `compatibility-contract`: record that CLI `inspect` / `info` / `resolve` (with `list`) observe through in-repo Core read ports while freezing the published SDK inspect/list shapes and v1 CLI contracts.
- `runtime-boundaries`: require those read commands to remain thin CLI projectors over Core read observation rather than a second lifecycle engine or a public-SDK re-wrap.
- `product-readme`: extend the 1.12 Core transition narrative to include Core-backed CLI `inspect` / `info` / `resolve` without implying SDK method changes.

## Impact

- `src/commands/{inspect,info,resolve}.ts` stay thin Core-backed projectors; shared CLI projection helpers may be extracted for clarity.
- `src/services/core-read-observations.ts` remains the CLI→Core read adapter (`quantex-core/internal`); no public SDK expansion.
- `openspec/specs/{compatibility-contract,runtime-boundaries,product-readme}` receive deltas.
- `README.md` / `README.zh-CN.md` / `README.en.md` / `packages/core/README.md` update 1.12 wording for the read-observation slice.
- Existing `test/commands/{inspect,info,resolve}.test.ts`, `test/services/core-read-observations.test.ts`, and related `--json` / compatibility suites remain the regression gate.
- Out of scope: public SDK method expansion, Core publish workflow, rewriting out-of-scope stable commands, new aliases, state schema migration, 2.x identity.
