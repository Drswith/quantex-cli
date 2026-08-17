## Why

Every catalog entry is a standing support obligation, not a one-time addition. Each one carries install methods across three platforms, a version probe, an update strategy, a slot in the scheduled agent-canary matrix, normative requirements in `agent-catalog`, and a row in the published support matrix. That cost is paid on every refactor of the install, probe, resolution, and canary paths regardless of how many users the entry serves.

The maintainer has decided to concentrate that budget on the agents Quantex users actually reach for, and to remove five entries at the low-adoption end. Measured 2026-08-17:

| Entry | GitHub stars | Last upstream activity | Adoption signal |
|---|---|---|---|
| `jcode` | 17,757 | 2026-08-17 | no registry distribution (brew/script only) |
| `forgecode` | 7,491 (`tailcallhq/forgecode`) | 2026-08-16 | npm 2,970 / last month |
| `deepcode` | 2,189 | 2026-08-14 | npm 11,243 / last month |
| `vtcode` | 807 | 2026-08-16 | crates.io 2,846 / last 90 days |
| `genie` | n/a (JSR-only) | 2025-09-05 | JSR-only; no published download metrics |

Retained entries for comparison: `openclaw` 11,417,551, `auggie` 160,722, `reasonix` 56,705, `codewhale` 18,943 npm downloads per month.

There is one reason, and it applies to all five equally: Quantex is narrowing which agents it commits to supporting, and these five sit at the low-adoption end. Upstream health is not part of the basis. The maintenance column above is recorded only to keep the withdrawal from being misread later — **these are maintained projects**, and `jcode` is by stars the largest in the table. No entry here is being removed for being abandoned, stale, or defective.

Removing catalog entries changes observable CLI behavior and agent catalog metadata, so this is classified as requiring an OpenSpec change before code edits.

## What Changes

- Remove `jcode`, `deepcode`, `genie`, `vtcode`, and `forgecode` from the agent catalog. `list`, `install`, `ensure`, `update`, `uninstall`, `run`, `info`, `inspect`, and `resolve` no longer recognize these canonical names or the `forge` alias.
- Retain `jcode`, `deepcode`, `genie`, and `vtcode` as frozen root exports from a new `src/agents/withdrawn` module. These four are part of the v1 export snapshot, so `import { vtcode } from 'quantex-cli'` keeps compiling. They are absent from `getAllAgents`, from agent lookup, and from every lifecycle command. `forgecode` postdates the snapshot, is not a v1 export, and is removed outright.
- Record the retention rule in `compatibility-contract`, including that the retained symbols retire together in a future approved major change rather than one deprecation window per withdrawn agent.
- Update the pinned root-declaration byte count and digest. Retaining the four symbols in one module moves their declarations within `dist/index.d.mts`; the emitted types and the exported symbol set are unchanged, and the change records that evidence.
- Retain the `deno` install provider, whose only catalog consumer was `genie`, with synthetic test coverage.
- Update `README.md`, `README.zh-CN.md`, `docs/agent-support-matrix.md`, and `skills/quantex-cli/references/command-recipes.md`.

**Not changing** (deliberately):

- The v1 root export set. `test/fixtures/compatibility/v1/root-exports.json` is unchanged, and the downstream consumer that `verify-package-distribution.ts` compiles still imports all 117 names.
- The `deno`, `cargo`, `brew`, and `script` provider implementations. Removing catalog consumers is not a reason to remove provider support.
- Persisted state. A user who already installed one of these agents keeps their `installedAgents` record; Quantex reports it as an untracked agent rather than rewriting or deleting state.
- Any command, flag, schema field, or diagnostic code.

## Capabilities

### Modified Capabilities

- `agent-catalog`: the `ForgeCode MUST be a supported lifecycle agent` and `VTCode MUST be a supported lifecycle agent` requirements are removed, and catalog membership gains an explicit withdrawal rule. `jcode`, `deepcode`, and `genie` carry no dedicated requirement and are removed as catalog data only.
- `compatibility-contract`: add the rule that a withdrawn entry whose name is in the v1 export snapshot retains a frozen root export, so the facade guarantee is honored rather than excepted.

### New Capabilities

- None. This narrows an existing surface.

## Impact

- **Not breaking.** No export, command, flag, schema field, type, or persisted-state format is removed. This targets a normal minor release and merges to `main` without waiting on the stable v2 readiness gate.
- Affected catalog data: `src/agents/catalog/{jcode,deepcode,genie,vtcode,forgecode}.json` deleted; `src/agents/generated/*` and `src/core/generated/*` regenerated.
- New module: `src/agents/withdrawn/` holding the four frozen definitions and their JSON, projected through the same normalization as catalog entries via a newly exported `toAgentDefinition`. `toAgentDefinition` is not re-exported from `src/agents/index.ts`, so it stays off the v1 root surface.
- Affected exports: `src/agents/index.ts` and `src/compatibility/index.ts` re-export the four withdrawn names from the new module instead of from the generated catalog.
- Affected compatibility fixtures: `test/fixtures/compatibility/v1/root-declaration.json` only. The declarations `declare const deepcode: AgentDefinition` and its three siblings are emitted unchanged; only their position in the file moves.
- Affected tests: `test/agents.test.ts` (including a new `withdrawn agents` suite), `test/index.test.ts`, `test/agent-canary-matrix.test.ts`, `test/catalog-normalized-python-rust.test.ts`, `test/catalog-support-generation.test.ts`, and the v1 command-family goldens for `capabilities`, `list`, and the `ls` alias.
- Affected docs: `README.md`, `README.zh-CN.md`, `docs/agent-support-matrix.md`, `skills/quantex-cli/references/command-recipes.md`.
