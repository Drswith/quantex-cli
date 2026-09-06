## Why

`quantex upgrade` / `qtx upgrade` still plan, check, and apply through
`src/self/application.ts` plus a services production invocation, while every
other promoted CLI family already executes behind a thin projection over an
in-repo Core engine. After P5 leftover pruning, this P6 knife is the first
self-upgrade Core move: keep the frozen 1.x CLI contract and relocate
ownership without inventing a parallel engine or expanding the published SDK.

Work-intake classification: observable CLI routing / architecture boundary /
product-facing docs — OpenSpec is required.

## What Changes

- Route CLI `upgrade` **plan**, **check**, and **apply** through an in-repo Core
  self-upgrade engine that reuses the existing `src/self` domain modules
  (planning, providers, binary replacement, locks, verification).
- Keep `src/commands/upgrade.ts` as a thin projector for argv, human/JSON/NDJSON
  presentation, and exit policy. JSON MUST NOT expose engine or route.
- Delete only proven zero-ref shells after the move: `src/self/application.ts`.
  KEEP `src/services/self-upgrade-production.ts` as the CLI/self bridge so Core
  stays free of `src/self` imports.
- KEEP every still-differential `src/self` module (facts, planning, providers,
  binary, lock, recovery, state persistence).
- Freeze aliases (`quantex` / `qtx`), `--json` / `--check` / `--channel` /
  dry-run plan shape, exit codes, structured codes from #700 (`NETWORK_ERROR`,
  `MANUAL_ACTION_REQUIRED`), `UPGRADE_FAILED`, and state schema v2.
  JSON MUST NOT expose engine or route. Changelog framing for this knife is
  internal.
- Document the Core route in product READMEs without adding commands or SDK
  methods.
- Stay on the 1.x line. Do not publish `upgrade()` on `quantex-core`.

## Capabilities

### New Capabilities

- None. Self-upgrade stays the existing bounded context (ADR 0002). This knife
  does not create a new capability name.

### Modified Capabilities

- `self-upgrade`: CLI `upgrade` SHALL plan, check, and apply through in-repo
  Core while preserving frozen `--check` / `--channel` / dry-run / error
  contracts.
- `runtime-boundaries`: CLI `upgrade` SHALL stay a thin facade over the Core
  self-upgrade engine and MUST NOT become a second planner/mutator.
- `compatibility-contract`: Core routing for this 1.x knife includes CLI
  `upgrade` without publishing SDK `upgrade`, without leaking engine/route in
  JSON, and without changing `--channel`, packages/binaries, or state v2.
- `product-readme`: product READMEs SHALL identify CLI `upgrade` as Core-backed
  while stating the published SDK does not gain `upgrade`.

## Impact

- Code: `src/core/self-upgrade-executor.ts`, `src/commands/upgrade.ts`,
  `src/services/self-upgrade-production.ts`; delete `src/self/application.ts`
  after zero-ref proof. KEEP remaining `src/self` domain modules and the CLI
  production bridge.
- Tests: ownership lock, `--json` / `--check` / `--channel` / dry-run shape,
  `NETWORK_ERROR` / `MANUAL_ACTION_REQUIRED` / `UPGRADE_FAILED`, no engine/route
  leak.
- Docs: `README.md`, `README.zh-CN.md`, `packages/core/README.md`, living
  OpenSpec specs listed above.
- Out of scope: YAML / `release-core.yml` / protect-main; folding `config` /
  `capabilities` / `commands` / `schema`; shelved changes
  `release-one-line-delivery`, `release-pr-skip-human-heuristics`,
  `windows-ci-advisory-merge-gate`; agent-lifecycle `update` engines; published
  Core SDK expansion; 2.x.
