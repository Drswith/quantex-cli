# ADR 0014: Delete leftover lifecycle barrel after Core-internal engines

- Status: Accepted
- Date: 2026-09-07

## Context

L1–L3 moved receipt types, provider-binding/evidence, and remaining engines into `src/core/lifecycle/` without expanding the published SDK. ADR 0013 left the `src/lifecycle` barrel in place as an existing non-SDK facade and required a dedicated L4 change before deleting that directory.

After L3 the directory contained only `index.ts`, which re-exported Core-internal helpers. Remaining callers were `lifecycle-execution-production`, `lifecycle-policy`, and tests that still imported `src/lifecycle`. Keeping that facade preserved a leftover path the internalization series exists to remove.

## Decision

- Remaining callers import Core-internal modules directly (`src/core/lifecycle/model`, `provider-binding`, `provider-evidence`, `agent-observation`, `update-planner`, and siblings as needed).
- `src/lifecycle/` is deleted. Do not leave a shim at the old barrel path.
- Do not add `src/core/lifecycle/index.ts`. Direct imports keep the published SDK eager closure from loading extra helpers by accident.
- Do not re-export those symbols from `src/core/index.ts` or `packages/core`.
- `src/state` still may import only the model leaf (ADR 0011). It MUST NOT import other Core-internal lifecycle modules or Core runtime.

## Consequences

- L4 can delete the leftover barrel without creating `state → Core runtime` and without expanding `quantex-core`.
- Ownership tests must require `src/lifecycle/` to be absent and named callers to import Core-internal paths.
- Later work MUST NOT restore `src/lifecycle/` or add a Core lifecycle barrel without a new OpenSpec change that explicitly expands that surface.

## Alternatives Considered

- Keep the barrel indefinitely as a convenience facade. Rejected: it is the leftover L4 exists to remove.
- Replace it with `src/core/lifecycle/index.ts`. Rejected: SDK expansion and eager-closure risk (ADR 0011–0013).
- Re-export helpers from `src/core/index.ts`. Rejected: that is a public SDK change, not this knife.
- Leave a shim at `src/lifecycle/index.ts`. Rejected: it keeps the old path and looks like a leftover.

## Follow-up

- `runtime-boundaries` and `compatibility-contract` OpenSpec deltas in `lifecycle-barrel-core-internal-l4`.
- Do not archive L2 or L3 from the L4 branch; those remain separate archive PRs.
