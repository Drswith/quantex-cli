## Context

After P0–P8, in-repo Core owns install/ensure/update/uninstall/exec/doctor/upgrade engines, but Core still imports shared receipt types from `src/lifecycle/model`. P8 (#717) documented KEEP for that file: `src/state` and `package-manager` import `LifecycleReceipt` from it, and “moving into `src/core` would invert `state → Core`.”

That warning is correct for a **naive** move (state importing `src/core/index.ts`, executors, or any Core module that already imports state). It is not a reason to leave types in `src/lifecycle` forever. L1 needs a placement that:

- removes `Core → src/lifecycle/model`
- lets `state` and remaining lifecycle modules share the same types
- does not create `Core → state → Core` cycles
- does not publish new `quantex-core` exports

Current graph (simplified):

```text
src/core/* ──imports──► src/lifecycle/model ◄──imports── src/state
src/core/* ──imports──► src/state
src/lifecycle/* ──imports──► src/lifecycle/model
```

`src/lifecycle/model.ts` is already a zero-import leaf. The inversion risk is ownership placement, not the type module’s own dependencies.

## Goals / Non-Goals

**Goals:**

- Own receipt/observation types and `LIFECYCLE_RECEIPT_SCHEMA_VERSION` in a Core-internal leaf.
- Update every `lifecycle/model` import (production and tests).
- Preserve frozen contracts: state v2, receipt JSON shape, `--json`, aliases, exit codes, no `engine`/`route` in JSON.
- Keep published SDK export surface identical (`createQuantex` + existing inspection/mutation types only).
- Lock the L1 graph so later knives cannot smuggle Core runtime into `state`.

**Non-Goals:**

- L2+: provider-binding/evidence, observation, update-planner, agent-execution, uninstall-postcondition, deleting `src/lifecycle/`.
- Expanding commands or `packages/core` / `src/core/index.ts`.
- Folding config, capabilities, commands, or schema registries.
- YAML, `release-core.yml`, protect-main, or shelved OpenSpec changes.

## Decisions

### 1. Core-internal leaf, not Core runtime and not a third package

Place the module at `src/core/lifecycle/model.ts`.

- The file remains a **leaf**: no imports from Core runtime, `state`, `lifecycle`, providers, or CLI.
- `src/core/index.ts` and `packages/core/src/index.ts` MUST NOT re-export it.
- Remaining `src/lifecycle/index.ts` MAY re-export types/constants as an existing non-SDK path for CLI/services that already imported the barrel.
- `src/state/schema.ts` MAY re-export `LIFECYCLE_RECEIPT_SCHEMA_VERSION` from the leaf so state tests keep their current import site while the constant has one source of truth.

This is the smallest move that makes Core the owner without creating a new workspace package (ADR 0007 already rejected splitting Core into extra packages).

### 2. `state` may import the leaf, never Core runtime

P8’s inversion is real if `state` imported Core **runtime** (`./client`, executors, `src/core/index.ts`). Core already imports `src/state` at runtime (`installation-production`, `uninstall-executor`, `update-production`). A `state → core/index` edge would cycle.

A `state → src/core/lifecycle/model` edge does **not** cycle: the leaf has no reverse imports. Type-only imports are erased at emit; the receipt-schema constant is a primitive value and is still cycle-free.

Ownership tests MUST lock:

- `src/state/**` import specifiers matching `../core` are only `../core/lifecycle/model`.
- `src/core/index.ts` / `packages/core` do not mention `LifecycleReceipt`, `LIFECYCLE_RECEIPT_SCHEMA_VERSION`, or `./lifecycle`.
- `src/lifecycle/model.ts` is absent.
- Remaining P8 KEEP modules still live under `src/lifecycle/`.

### 3. No compatibility shim at `src/lifecycle/model.ts`

L1 is a move, not a re-export leftover. Every `lifecycle/model` import is rewritten. A shim would keep the reverse path Core was trying to delete and would look like a P8 leftover.

The lifecycle **barrel** stays. It is not a model shim; it is the existing non-SDK facade for remaining L2+ modules plus type re-exports.

### 4. Changelog is internal

No user-visible command, JSON, or SDK change. Release framing is `refactor:` so release-please files it under Internal Improvements and does not bump from this knife alone.

## Risks / Trade-offs

- [Risk] Later L2 moves a runtime lifecycle module into Core and `state` starts importing that module too → cycle with Core’s existing `state` imports. → Mitigation: ownership test allows only the model leaf from `src/state`; L2+ must keep `state` off Core runtime.
- [Risk] Someone re-exports the leaf from `packages/core` “for convenience.” → Mitigation: architecture/ownership tests on `src/core/index.ts` and `packages/core/src/index.ts`; compatibility-contract forbids SDK growth from this knife.
- [Risk] Receipt constant drifts between state and Core. → Mitigation: one export in the leaf; state re-exports it.
- [Trade-off] `src/core/lifecycle/` as a directory looks like an invitation to dump L2 engines there immediately. L1 only places `model.ts`; remaining modules stay under `src/lifecycle/` until their own knives.

## Migration Plan

1. Add `src/core/lifecycle/model.ts` with the current types/constant (`as const` on the schema version so state keeps a literal `1`).
2. Retarget importers; delete `src/lifecycle/model.ts`.
3. Update ownership tests; run lint/format/typecheck/test/openspec/memory.
4. Draft PR; do not archive this OpenSpec change until the implementation PR merges and spec deltas are synced.

Rollback: revert the PR. No persisted-state migration.

## Open Questions

None for L1. L2+ placement of provider-binding vs observation remains a later design; this change MUST NOT pre-move those modules.
