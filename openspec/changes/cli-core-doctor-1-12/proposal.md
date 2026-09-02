## Why

Quantex 1.12's first three slices moved CLI lifecycle mutation, read observation, and exec/shortcut onto in-repo Core. `doctor` still owns environment diagnosis and issue synthesis in the CLI command module while already consuming Core-backed agent read observation. This fourth slice relocates diagnosis ownership into in-repo Core behind a thin CLI facade, without expanding the published `quantex-core` SDK or reshaping frozen doctor contracts.

Work-intake classification: observable CLI behavior, architecture boundaries, and product-facing Core transition docs. OpenSpec required before edits.

## What Changes

- Make CLI `doctor` a thin facade over an in-repo Core diagnosis engine that synthesizes environment/installer/self/agent observations into the frozen doctor payload and recovery guidance, rather than wrapping a public SDK `doctor()` method.
- Keep CLI responsible for gathering CLI-coupled observations (provider snapshot, self read-only inspection, Core-backed agent reads), presentation, and exit policy.
- Do **not** expand the published `quantex-core` public API (`createQuantex` surface); no new SDK `doctor` / `diagnose` methods.
- Do **not** change `release-core.yml`, independently publish Core, or add commands/aliases.
- Freeze package identity (`quantex-cli`), binaries (`qtx` / `quantex`), state schema version 2, doctor command name/aliases (none), `--json` shape, exit codes, and v1 root exports.
- Update compatibility, runtime-boundary, and product-readme contracts so 1.12 describes Core-backed CLI `doctor` without implying an SDK expansion.
- Archive completed OpenSpec change `cli-core-exec-1-12` as part of this delivery (spec deltas synced; active change removed).
- Out of scope: upgrade, config, capabilities, commands, schema, exec (already done), catalog, Core npm publish.

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `compatibility-contract`: record that CLI `doctor` diagnoses through in-repo Core while freezing the published SDK surface and v1 doctor JSON/exit contracts.
- `runtime-boundaries`: require `doctor` to remain a thin CLI projector over Core diagnosis rather than a second diagnosis engine or a public-SDK `doctor()` re-wrap.
- `product-readme`: extend the 1.12 Core transition narrative to include Core-backed CLI `doctor` without implying SDK method changes.

## Impact

- `src/core/doctor-diagnosis.ts` owns ports-fed diagnosis synthesis; CLI production wiring remains a thin bridge that injects installer/self/agent observations.
- `src/commands/doctor.ts` stays presentation-focused over Core diagnosis outcomes.
- `openspec/specs/{compatibility-contract,runtime-boundaries,product-readme}` receive deltas.
- `README.md` / `README.zh-CN.md` / `packages/core/README.md` update 1.12 wording for the doctor slice.
- Existing `test/commands/doctor.test.ts` and related `--json` / schema suites remain the regression gate.
- Out of scope: public SDK method expansion, Core publish workflow, rewriting out-of-scope stable commands, new aliases, state schema migration, 2.x identity.
