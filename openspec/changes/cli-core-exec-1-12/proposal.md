## Why

Quantex 1.12's first two slices moved CLI lifecycle mutation and read observation onto in-repo Core. `exec` and shortcut `qtx <agent> [args...]` still own agent launch through CLI/services execution modules. This third slice relocates execution ownership into in-repo Core behind thin CLI facades, without expanding the published `quantex-core` SDK or reshaping frozen CLI contracts.

Work-intake classification: observable CLI behavior, architecture boundaries, and product-facing Core transition docs. OpenSpec required before edits.

## What Changes

- Make CLI `exec` and shortcut `qtx <agent> [args...]` thin facades over an in-repo Core execution engine (the same ports-based launch path `runCommand` already uses), projecting frozen human/JSON contracts and exit codes rather than wrapping a public SDK `run()` / `exec()` method.
- Preserve existing `--install` policy semantics on `exec` (`never` / `if-missing` / `always`) and shortcut prompt/auto-install behavior.
- Keep CLI responsible for argv parsing, presentation, exit codes, and process I/O policy (including human stdio inherit for agent processes).
- Do **not** expand the published `quantex-core` public API (`createQuantex` surface); no new SDK `run` / `exec` methods.
- Do **not** change `release-core.yml`, independently publish Core, or add commands/aliases.
- Freeze package identity (`quantex-cli`), binaries (`qtx` / `quantex`), state schema version 2, command names/aliases, `--json` / `--output`, exit codes, and v1 root exports.
- Update compatibility, runtime-boundary, and product-readme contracts so 1.12 describes Core-backed CLI exec/shortcut without implying an SDK expansion.
- Archive completed OpenSpec change `cli-core-read-observation-1-12` as part of this delivery (spec deltas synced; active change removed).
- Out of scope: upgrade, config, doctor, capabilities, commands, schema, catalog, Core npm publish.

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `compatibility-contract`: record that CLI `exec` and shortcut launch observe/install/launch through in-repo Core execution while freezing the published SDK surface and v1 CLI contracts, including `--install` policy.
- `runtime-boundaries`: require `exec` / shortcut to remain thin CLI projectors over Core execution rather than a second launch engine or a public-SDK `run()` re-wrap; CLI retains process I/O policy.
- `product-readme`: extend the 1.12 Core transition narrative to include Core-backed CLI `exec` / shortcut without implying SDK method changes.

## Impact

- `src/core/execution-executor.ts` owns the ports-based agent execution engine; CLI production wiring remains a thin bridge that injects observation, install, and process ports.
- `src/commands/run.ts` stays presentation-focused over Core execution outcomes; `exec` handler and shortcut path keep argv/`--install` policy ownership.
- `src/services/lifecycle-execution.ts` becomes a deprecated re-export of the Core engine.
- `openspec/specs/{compatibility-contract,runtime-boundaries,product-readme}` receive deltas.
- `README.md` / `README.zh-CN.md` / `packages/core/README.md` update 1.12 wording for the exec slice.
- Existing `test/commands/run.test.ts`, `test/services/lifecycle-execution*.test.ts`, shortcut tests, and related `--json` / `--install` suites remain the regression gate.
- Out of scope: public SDK method expansion, Core publish workflow, rewriting out-of-scope stable commands, new aliases, state schema migration, 2.x identity.
