# ADR 0012: Core-internal lifecycle provider-binding

- Status: Accepted
- Date: 2026-09-07

## Context

L1 (ADR 0011) moved receipt types to `src/core/lifecycle/model.ts` as a zero-import leaf so `src/state` could share them without depending on Core runtime. Core install/uninstall/update/execution still imported provider-binding resolvers and `observeLifecycleProvider` from `src/lifecycle`, which is the next reverse-dependency knife.

Those modules are not leaves: they import agents, provider types, the model leaf, type-only state, and (for evidence) the first-party provider registry. ADR 0011 warned that later knives must keep `state` off Core runtime. Dumping every remaining engine into `src/core/lifecycle/` without a dedicated change was also forbidden.

## Decision

- Provider-binding resolution and `observeLifecycleProvider` live at `src/core/lifecycle/provider-binding.ts` and `src/core/lifecycle/provider-evidence.ts`.
- They are Core-**internal** and MUST NOT be re-exported from `src/core/index.ts` or `packages/core`.
- They are **not** leaves. `src/state` MUST NOT import them; it may still import only the model leaf.
- Do not add `src/core/lifecycle/index.ts`. Direct imports keep the published SDK eager closure from loading evidence/first-party providers by accident.
- Do not leave shims at `src/lifecycle/provider-binding.ts` or `src/lifecycle/provider-evidence.ts`. The `src/lifecycle` barrel MAY re-export helpers as an existing non-SDK path.
- Remaining engines (agent-observation, update-planner, agent-execution, uninstall-postcondition) stay under `src/lifecycle/` until their own approved knives.

## Consequences

- L2 can delete `Core → src/lifecycle/provider-binding|provider-evidence` without creating `state → Core runtime`.
- Ownership tests must distinguish the model leaf (state-importable) from binding/evidence (Core-internal, state-forbidden).
- Published SDK consumers still cannot import binding helpers from `quantex-core`.
- L3+ still needs its own OpenSpec change; this directory is not a dump.

## Alternatives Considered

- Keep binding/evidence in `src/lifecycle` indefinitely. Rejected: it preserves the reverse dependency L2 exists to remove.
- Merge both files into the model leaf. Rejected: that would give the leaf imports and recreate the P8 inversion if state imported it.
- Re-export from `src/core/index.ts` or add `src/core/lifecycle/index.ts`. Rejected: SDK expansion and eager-closure risk (`firstPartyProviderRegistry`).
- Leave shims at the old `src/lifecycle` paths. Rejected: they keep the old reverse path and look like leftovers.

## Follow-up

- `runtime-boundaries` and `compatibility-contract` OpenSpec deltas in `lifecycle-provider-core-internal-l2`.
- L3+ knives MUST NOT fold observation, update-planner, agent-execution, or uninstall-postcondition without their own change.
