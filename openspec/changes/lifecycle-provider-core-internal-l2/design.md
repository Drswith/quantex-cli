## Context

After L1, Core owns receipt types at `src/core/lifecycle/model.ts`, but Core install/uninstall/update/execution still import provider-binding resolution from `src/lifecycle/provider-binding.ts` and provider observation from `src/lifecycle/provider-evidence.ts`. That is the remaining reverse dependency this knife removes.

Current graph (simplified):

```text
src/core/* ──imports──► src/lifecycle/provider-binding ◄──imports── remaining src/lifecycle engines
src/core/* ──imports──► src/lifecycle/provider-evidence
src/core/* ──imports──► src/state
src/state  ──imports──► src/core/lifecycle/model   (leaf only; ADR 0011)
```

Unlike the L1 model leaf, these modules are **not** zero-import:

- `provider-binding` imports agents, `providers/types`, the model leaf, and type-only `InstalledAgentState` from state.
- `provider-evidence` imports the first-party provider registry (value) plus binding helpers.

Moving them under `src/core/` does **not** invert `state → Core runtime` as long as `src/state` continues to import only the model leaf. A `state → provider-binding` edge would cycle because provider-binding already depends on state types and Core already depends on state at runtime.

ADR 0011 already forbids treating `src/core/lifecycle/` as a dump for remaining engines without their own change. L2 is that change for binding/evidence only.

## Goals / Non-Goals

**Goals:**

- Own provider-binding resolution and `observeLifecycleProvider` in Core-internal modules under `src/core/lifecycle/`.
- Update every `lifecycle/provider-binding` and `lifecycle/provider-evidence` import (production and tests).
- Preserve frozen contracts: state v2, receipt JSON shape, `--json`, aliases, exit codes, no `engine`/`route` in JSON.
- Keep published SDK export surface identical (`createQuantex` + existing inspection/mutation types only).
- Lock the L2 graph so `state` cannot import binding/evidence, and later knives cannot smuggle Core runtime into `state`.

**Non-Goals:**

- L3+: agent-observation, update-planner, agent-execution, uninstall-postcondition, deleting `src/lifecycle/`.
- Expanding commands or `packages/core` / `src/core/index.ts`.
- Folding config, capabilities, commands, or schema registries.
- YAML, `release-core.yml`, protect-main, or shelved OpenSpec changes.
- Archiving L1 (`lifecycle-model-core-internal-l1`); that archive stays a separate PR.

## Decisions

### 1. Same Core-internal directory as L1, still not a barrel

Place the modules at `src/core/lifecycle/provider-binding.ts` and `src/core/lifecycle/provider-evidence.ts`.

- Keep them as two files. Do not merge evidence into binding; evidence is the observation helper plus binding re-exports, not a leftover pass-through.
- Do **not** add `src/core/lifecycle/index.ts`. A Core-internal barrel would invite dumping L3 engines and could pull `firstPartyProviderRegistry` into the published SDK eager/complete closure.
- `src/core/index.ts` and `packages/core/src/index.ts` MUST NOT re-export binding/evidence symbols.
- Remaining `src/lifecycle/index.ts` MAY re-export helpers as an existing non-SDK path for CLI/services that already imported the barrel.

This follows ADR 0011's directory choice and ADR 0007's rejection of extra packages.

### 2. These modules are Core-internal, not leaves

`src/state` MAY import only `src/core/lifecycle/model`. It MUST NOT import provider-binding, provider-evidence, or Core runtime (`src/core/index.ts`, `createQuantex`, executors).

Binding/evidence MAY:

- import the model leaf
- import agents and `providers/types`
- type-import `InstalledAgentState` from state (existing direction: Core → state)
- value-import `firstPartyProviderIds` / `firstPartyProviderRegistry` as they do today

They MUST NOT import remaining `src/lifecycle` engines, CLI, or Core executors (no new cycles inside Core-internal).

Eager SDK closure today already loads `provider-binding` via production observation. After the move that file lives under `src/core/`, so it drops out of the outside-Core allowlist. `provider-evidence` stays off the eager path: `createQuantex` / `client.ts` MUST type-import `LifecycleProviderBinding` from provider-binding, not value-import evidence.

### 3. No compatibility shims at the old paths

L2 is a move, not a leftover. Every `lifecycle/provider-binding` and `lifecycle/provider-evidence` import is rewritten. Shims would keep the reverse path Core is deleting.

The lifecycle **barrel** stays. It is not a binding shim; it is the existing non-SDK facade for remaining L3+ modules plus helper re-exports.

### 4. Changelog is internal

No user-visible command, JSON, or SDK change. Release framing is `refactor:` so release-please files it under Internal Improvements and does not bump from this knife alone.

## Risks / Trade-offs

- [Risk] `state` starts importing provider-binding after it lives under `src/core/lifecycle/` → cycle with Core's existing `state` imports. → Mitigation: ownership test allows only `../core/lifecycle/model` from `src/state`; L3+ must keep `state` off Core runtime and off binding/evidence.
- [Risk] A Core lifecycle barrel or SDK re-export pulls `firstPartyProviderRegistry` into the eager public closure. → Mitigation: no `src/core/lifecycle/index.ts`; architecture tests keep `src/providers/first-party.ts` out of eager and complete SDK closures; `client.ts` type-imports binding only.
- [Risk] Someone treats L2 as permission to fold observation/planner/execution next. → Mitigation: ownership tests still require those files under `src/lifecycle/`; this change's remaining-engine requirement lists them explicitly.
- [Trade-off] CLI/services retarget to `src/core/lifecycle/provider-binding` instead of keeping the old path. That is the point of the knife; the barrel remains available for existing `from '../lifecycle'` imports.

## Migration Plan

1. `git mv` the two modules into `src/core/lifecycle/` and fix their relative imports (agents/providers/state/model).
2. Retarget every importer; delete the old paths (no shims).
3. Update ownership and Core-boundary tests; add ADR 0012; thin AGENTS.md pointer.
4. Run lint/format/typecheck/test/openspec/memory.
5. Draft PR; do not archive this OpenSpec change until the implementation PR merges and spec deltas are synced. Do not archive L1 from this branch.

Rollback: revert the PR. No persisted-state migration.

## Open Questions

None for L2. L3+ placement of observation vs planner remains a later design; this change MUST NOT pre-move those modules.
