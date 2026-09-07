# ADR 0013: Core-internal lifecycle observation and remaining engines

- Status: Accepted
- Date: 2026-09-07

## Context

L1 (ADR 0011) moved receipt types to `src/core/lifecycle/model.ts` as a zero-import leaf so `src/state` could share them without depending on Core runtime. L2 (ADR 0012) moved provider-binding and provider-evidence into Core-internal modules that are not leaves. Core observation, update, execution, and uninstall still imported remaining engines from `src/lifecycle`, which is the next reverse-dependency knife.

Those modules are not leaves: observation imports agents, providers, type-only state, binding, and version comparison; the update planner imports the model leaf and version utils; execution preflight imports observation types; uninstall postcondition is a small retry helper. ADR 0011/0012 warned that later knives must keep `state` off Core runtime and must not dump remaining engines without a dedicated change. Deleting the `src/lifecycle` barrel is a later L4 knife.

## Decision

- Agent observation, update planning, execution preflight, and uninstall postcondition live at `src/core/lifecycle/agent-observation.ts`, `update-planner.ts`, `agent-execution.ts`, and `uninstall-postcondition.ts`.
- They are Core-**internal** and MUST NOT be re-exported from `src/core/index.ts` or `packages/core`.
- They are **not** leaves. `src/state` MUST NOT import them; it may still import only the model leaf.
- Do not add `src/core/lifecycle/index.ts`. Direct imports keep the published SDK eager closure from loading planner/execution/postcondition by accident.
- Do not leave shims at the old `src/lifecycle/` paths. The `src/lifecycle` barrel MAY re-export helpers as an existing non-SDK path.
- Do not delete `src/lifecycle/` in this knife. The barrel stays until an approved L4 change.

## Consequences

- L3 can delete `Core → src/lifecycle/{agent-observation,update-planner,agent-execution,uninstall-postcondition}` without creating `state → Core runtime`.
- Ownership tests must distinguish the model leaf (state-importable) from these engines (Core-internal, state-forbidden).
- Published SDK consumers still cannot import observation/planner/execution helpers from `quantex-core`.
- `agent-observation` drops out of the outside-Core eager-closure allowlist because it now lives under `src/core/`.
- L4 still needs its own OpenSpec change; this directory is not permission to delete the remaining barrel.

## Alternatives Considered

- Keep the four engines in `src/lifecycle` indefinitely. Rejected: it preserves the reverse dependency L3 exists to remove.
- Merge them into Core executors or the model leaf. Rejected: that would mix planning/observation with mutation executors, or give the leaf imports and recreate the P8 inversion if state imported it.
- Re-export from `src/core/index.ts` or add `src/core/lifecycle/index.ts`. Rejected: SDK expansion and eager-closure risk.
- Leave shims at the old `src/lifecycle` paths, or delete the barrel in the same knife. Rejected: shims keep the old reverse path; barrel deletion is L4.

## Follow-up

- `runtime-boundaries` and `compatibility-contract` OpenSpec deltas in `lifecycle-engines-core-internal-l3`.
- L4 MUST NOT delete the `src/lifecycle` barrel without its own change.
