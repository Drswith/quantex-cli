## Context

After the 1.12 lifecycle and read-observation slices, CLI mutation and read commands already execute through in-repo Core. Agent launch still lives in `services/lifecycle-execution*` called by `commands/run.ts`, which backs both `quantex exec` and shortcut `qtx <agent>`. The published SDK has no `run` / `exec` method, and product freeze forbids inventing one for this slice.

Hypothesis verified: `exec` / shortcut are thin presentation over a ports-based lifecycle execution engine that observes, optionally installs per `--install` policy, then spawns the agent. Human mode uses inherited stdio; structured modes reserve stdout. Core already has generic `runCoreInvocation` helpers, but agent launch ownership still sits outside `src/core/`.

## Goals / Non-Goals

**Goals:**

- Relocate the ports-based agent execution engine into in-repo Core modules under `src/core/`.
- Keep `exec` and shortcut as thin CLI facades: argv, `--install` policy, presentation, exit codes, and process I/O policy stay CLI-owned.
- Preserve frozen v1 `--json` / `--output`, exit codes, command names/aliases, package/binary identity, and state schema version 2.
- Keep the published `quantex-core` export surface unchanged.

**Non-Goals:**

- Expanding `createQuantex()` with `run` / `exec` or any new SDK method.
- Changing `release-core.yml` or Core's independent publish cadence.
- Rewriting upgrade / self-upgrade, config, doctor, capabilities, commands, schema, or catalog.
- Adding commands or aliases.
- State schema migration or 2.x identity.

## Decisions

### 1. In-repo Core execution engine, not a published SDK `run()`

Move `executeAgentLifecycle` and its outcome/port types into `src/core/execution-executor.ts`. Deliberately omit them from `src/core/index.ts` and `packages/core` exports. Do not wrap a fake public SDK `run()` into a second CLI-shaped API.

**Alternatives considered:** Publish SDK `run()` now — rejected by product freeze. Keep the engine in `src/services/` and only rename imports — rejected because new/relocated lifecycle behavior for 1.12 belongs under Core ownership.

### 2. CLI-coupled production wiring stays outside Core

The production adapter injects CLI operation context, lifecycle observation, install reconciliation, and process ports, and currently depends on `cli-context` / CLI operation context / lifecycle-observations — all forbidden Core imports. Keep that adapter as a CLI→Core bridge (services or command-adjacent), calling the Core engine with injected ports. Core must not import presentation, prompts, or CLI context.

### 3. CLI owns process I/O policy

The engine receives an explicit stdio policy from the CLI bridge instead of deciding inherit-vs-pipe from output mode inside Core. Human agent launch continues to use `['inherit','inherit','inherit']` as documented; structured modes keep stdout reserved. Argv parsing, `--install` defaults (`exec` → `never`; shortcut → `prompt`), presentation, and exit codes remain CLI responsibilities.

### 4. Product narrative updates without implying SDK growth

README wording for 1.12 adds Core-backed CLI `exec` / shortcut next to prior slices, while restating that the published SDK methods remain the previously published set and that Core publish stays independent.

## Risks / Trade-offs

- [Risk] Moving the engine could drift `--install` or `--json` contracts → Mitigation: existing `run` / lifecycle-execution tests plus focused `--json` / `--install` coverage are the gate.
- [Risk] Readers confuse CLI Core ownership with public SDK expansion → Mitigation: OpenSpec + README explicitly freeze the SDK surface and leave `release-core.yml` untouched.
- [Trade-off] Production wiring remains CLI-adjacent because observation/install ports are CLI-coupled; Core owns the pure launch state machine only.

## Migration Plan

1. Archive `cli-core-read-observation-1-12` (sync accepted deltas; remove active change).
2. Land OpenSpec deltas for the exec/shortcut slice.
3. Relocate the execution engine into Core; rewire the CLI bridge and thin facades.
4. Update product README Core transition wording.
5. Validate with lint/format/typecheck plus focused exec/shortcut/`--json`/`--install` tests.
6. Ship as part of 1.12 minor via release-please after merge; no Core npm publish required.

## Open Questions

- None for this slice.
