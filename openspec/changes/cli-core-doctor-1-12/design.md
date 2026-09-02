## Context

After the 1.12 lifecycle, read-observation, and exec slices, CLI mutation, read, and launch commands already execute through in-repo Core. `doctor` still synthesizes installer availability, self inspection, and agent observations into issues inside `src/commands/doctor.ts`, while agent observation already flows through Core-backed CLI read adapters. The published SDK has no `doctor` / `diagnose` method, and product freeze forbids inventing one for this slice.

Hypothesis verified: doctor inspects managed installers, self install facts, and registered agents, then synthesizes frozen recovery issues. Observation gathering is CLI-coupled (`self`, provider snapshot, CLI operation context). Diagnosis ownership should move under `src/core/` as a pure, ports-fed engine.

## Goals / Non-Goals

**Goals:**

- Relocate doctor diagnosis / issue synthesis into in-repo Core modules under `src/core/`.
- Keep `doctor` as a thin CLI facade: observation gathering via CLI bridge, presentation, and exit codes stay CLI-owned.
- Preserve frozen v1 `--json` shape, exit-code meanings (success path remains 0), command name/aliases (none), package/binary identity, and state schema version 2.
- Keep the published `quantex-core` export surface unchanged.

**Non-Goals:**

- Expanding `createQuantex()` with `doctor` / `diagnose` or any new SDK method.
- Changing `release-core.yml` or Core's independent publish cadence.
- Rewriting upgrade / self-upgrade, config, capabilities, commands, schema, exec, or catalog.
- Adding commands or aliases.
- Changing issue codes, `suggestedAction` identifiers, installer key set, or exit semantics.
- State schema migration or 2.x identity.

## Decisions

### 1. In-repo Core diagnosis engine, not a published SDK `doctor()`

Move diagnosis synthesis into `src/core/doctor-diagnosis.ts` as a pure function over already-observed installer/self/agent facts. Deliberately omit it from `src/core/index.ts` and `packages/core` exports. Do not wrap a fake public SDK `doctor()` into a second CLI-shaped API.

**Alternatives considered:** Publish SDK `doctor()` now — rejected by product freeze. Keep diagnosis in `src/commands/doctor.ts` and only rename helpers — rejected because 1.12 relocates observation/diagnosis ownership under Core.

### 2. CLI-coupled observation gathering stays outside Core

Provider snapshot, self read-only inspection, and CLI operation context depend on forbidden Core imports (`self`, `cli-context`). Keep a CLI→Core bridge that gathers those observations, projects Core-neutral diagnosis inputs (including package name and precomputed self recovery hints), and calls the Core engine. Core must not import presentation, prompts, or CLI context.

### 3. CLI owns presentation and exit policy

Human rendering, success envelope assembly, and exit policy remain CLI responsibilities. Core returns the frozen doctor `data` shape (agents, installers, issues, self) without emitting output or choosing exit codes. Success-path exit code remains 0; `blocking` stays a data field for automation.

### 4. Product narrative updates without implying SDK growth

README wording for 1.12 adds Core-backed CLI `doctor` next to prior slices, while restating that the published SDK methods remain the previously published set and that Core publish stays independent.

## Risks / Trade-offs

- [Risk] Moving diagnosis could drift `--json` issue codes or installer keys → Mitigation: existing `doctor.test.ts` plus schema/agent-update/self-upgrade scenarios are the gate; no intentional payload changes.
- [Risk] Readers confuse CLI Core ownership with public SDK expansion → Mitigation: OpenSpec + README explicitly freeze the SDK surface and leave `release-core.yml` untouched.
- [Trade-off] Observation gathering remains CLI-adjacent because self/provider ports are CLI-coupled; Core owns pure diagnosis only.

## Migration Plan

1. Archive `cli-core-exec-1-12` (sync accepted deltas; remove active change).
2. Land OpenSpec deltas for the doctor slice.
3. Relocate diagnosis into Core; rewire the CLI bridge and thin facade.
4. Update product README Core transition wording.
5. Validate with lint/format/typecheck plus focused doctor `--json` contract tests.
6. Ship as part of 1.12 minor via release-please after merge; no Core npm publish required.

## Open Questions

- None for this slice.
