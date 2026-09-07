## Context

After L2, Core owns receipt types, provider-binding, and provider-evidence under `src/core/lifecycle/`, but Core observation/update/execution/uninstall still import remaining engines from `src/lifecycle`:

```text
src/core/* ──imports──► src/lifecycle/agent-observation
src/core/* ──imports──► src/lifecycle/update-planner  (via barrel or direct)
src/core/* ──imports──► src/lifecycle/agent-execution (via barrel)
src/core/* ──imports──► src/lifecycle/uninstall-postcondition
src/core/* ──imports──► src/state
src/state  ──imports──► src/core/lifecycle/model   (leaf only; ADR 0011)
```

Unlike the L1 model leaf, these modules are **not** zero-import:

- `agent-observation` imports agents, providers, type-only state, the model leaf, provider-binding, and `compare-versions`.
- `update-planner` imports the model leaf and `utils/version`.
- `agent-execution` imports the model leaf and observation types.
- `uninstall-postcondition` is a small retry helper with no product-module imports.

Moving them under `src/core/` does **not** invert `state → Core runtime` as long as `src/state` continues to import only the model leaf.

ADR 0011 / 0012 already forbid treating `src/core/lifecycle/` as a dump without a dedicated change. L3 is that change for these four engines only. L4 (deleting the barrel / `src/lifecycle/`) remains a later knife.

## Goals / Non-Goals

**Goals:**

- Own agent observation, update planning, execution preflight, and uninstall postcondition helpers in Core-internal modules under `src/core/lifecycle/`.
- Update every production and test import of those four files.
- Preserve frozen contracts: state v2, receipt JSON shape, `--json`, aliases, exit codes, no `engine`/`route` in JSON.
- Keep published SDK export surface identical (`createQuantex` + existing inspection/mutation types only).
- Lock the L3 graph so `state` cannot import the moved engines, and later knives cannot smuggle Core runtime into `state`.

**Non-Goals:**

- L4: deleting `src/lifecycle/` or the remaining barrel.
- Expanding commands or `packages/core` / `src/core/index.ts`.
- Folding config, capabilities, commands, or schema registries.
- YAML, `release-core.yml`, protect-main, or shelved OpenSpec changes.
- Archiving L2 (`lifecycle-provider-core-internal-l2`); that archive stays a separate PR.

## Decisions

### 1. Same Core-internal directory as L1/L2, still not a barrel

Place the modules at:

- `src/core/lifecycle/agent-observation.ts`
- `src/core/lifecycle/update-planner.ts`
- `src/core/lifecycle/agent-execution.ts`
- `src/core/lifecycle/uninstall-postcondition.ts`

- Keep them as four files. Do not merge observation into binding, or planner into update-executor.
- Do **not** add `src/core/lifecycle/index.ts`. A Core-internal barrel would invite dumping remaining facades and could pull extra modules into the published SDK eager/complete closure.
- `src/core/index.ts` and `packages/core/src/index.ts` MUST NOT re-export these symbols.
- Remaining `src/lifecycle/index.ts` MAY re-export helpers as an existing non-SDK path for CLI/services/idempotency that already imported the barrel.

This follows ADR 0011/0012's directory choice and ADR 0007's rejection of extra packages.

### 2. These modules are Core-internal, not leaves

`src/state` MAY import only `src/core/lifecycle/model`. It MUST NOT import agent-observation, update-planner, agent-execution, uninstall-postcondition, provider-binding/evidence, or Core runtime (`src/core/index.ts`, `createQuantex`, executors).

The moved modules MAY:

- import the model leaf and sibling Core-internal lifecycle modules
- import agents, providers, and type-only persisted-state types (existing direction: Core → state)
- import existing utils already used today (`compare-versions`, `version`)

They MUST NOT import CLI, services, planning, or Core mutation/execution executors (no new cycles inside Core-internal).

Eager SDK closure today already loads `agent-observation` via production observation. After the move that file lives under `src/core/`, so it drops out of the outside-Core allowlist. `update-planner`, `agent-execution`, and `uninstall-postcondition` stay off the eager path: they are consumed by update/execution/uninstall engines, not `createQuantex` inspect.

### 3. No compatibility shims at the old paths

L3 is a move, not a leftover. Every `lifecycle/agent-observation`, `lifecycle/update-planner`, `lifecycle/agent-execution`, and `lifecycle/uninstall-postcondition` import is rewritten. Shims would keep the reverse path Core is deleting.

The lifecycle **barrel** stays. It is not an engine shim; it is the existing non-SDK facade plus helper re-exports until a later L4 knife.

### 4. Changelog is internal

No user-visible command, JSON, or SDK change. Release framing is `refactor:` so release-please files it under Internal Improvements and does not bump from this knife alone.

## Risks / Trade-offs

- [Risk] `state` starts importing observation or planner after they live under `src/core/lifecycle/` → cycle with Core's existing `state` imports. → Mitigation: ownership test allows only `../core/lifecycle/model` from `src/state`; L4 must keep `state` off Core runtime and off these engines.
- [Risk] A Core lifecycle barrel or SDK re-export pulls observation/planner into the public surface. → Mitigation: no `src/core/lifecycle/index.ts`; architecture/ownership tests keep SDK root free of these symbols; `createQuantex` remains the only runtime export.
- [Risk] Someone treats L3 as permission to delete `src/lifecycle/`. → Mitigation: ownership tests still require the barrel under `src/lifecycle/`; this change's remaining-facade requirement lists it explicitly. L4 needs its own OpenSpec change.
- [Trade-off] CLI services and planning retarget to `src/core/lifecycle/*` instead of keeping the old paths. That is the point of the knife; the barrel remains available for existing `from '../lifecycle'` imports.

## Migration Plan

1. `git mv` the four modules into `src/core/lifecycle/` and fix their relative imports (agents/providers/state/model/utils/siblings).
2. Retarget every importer; delete the old paths (no shims).
3. Update ownership and Core-boundary tests; add ADR 0013; thin AGENTS.md pointer.
4. Run lint/format/typecheck/test/openspec/memory.
5. Draft PR; do not archive this OpenSpec change until the implementation PR merges and spec deltas are synced. Do not archive L2 from this branch.

Rollback: revert the PR. No persisted-state migration.

## Open Questions

None for L3. L4 placement/deletion of the `src/lifecycle` barrel remains a later design; this change MUST NOT delete that directory.
