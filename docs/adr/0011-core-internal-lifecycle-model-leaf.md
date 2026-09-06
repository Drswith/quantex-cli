# ADR 0011: Core-internal lifecycle model leaf

- Status: Accepted
- Date: 2026-09-06

## Context

P8 leftover scan (#717) kept `src/lifecycle/model.ts` outside Core because `src/state` and `package-manager` import `LifecycleReceipt` from it. The scan warned that moving the file into `src/core` would invert `state → Core`.

That warning is correct if state imported Core **runtime** (`src/core/index.ts`, `createQuantex`, executors). Core already imports `src/state` at runtime, so a runtime reverse edge would cycle.

The types module itself is a zero-import leaf. Leaving it in `src/lifecycle` keeps an avoidable `Core → src/lifecycle` reverse dependency for evidence types Core already owns in practice.

## Decision

- Lifecycle receipt/observation/plan/outcome types and `LIFECYCLE_RECEIPT_SCHEMA_VERSION` live at `src/core/lifecycle/model.ts`.
- That file is a Core-**internal** leaf: no imports, and it is not part of the published `quantex-core` / `src/core/index.ts` surface.
- `src/state` MAY import that leaf (including a value re-export of the schema constant) and MUST NOT import Core runtime.
- Remaining `src/lifecycle/*` engines stay outside Core until a later approved knife. The `src/lifecycle` barrel MAY re-export leaf types as an existing non-SDK path.
- Do not leave a `src/lifecycle/model.ts` shim.

## Consequences

- L1 can delete `Core → src/lifecycle/model` without creating `Core → state → Core`.
- Later knives that move runtime lifecycle modules into Core MUST keep `state` off those modules.
- Published SDK consumers still cannot import receipt types from `quantex-core`.
- Ownership tests, not comments, enforce the leaf-only `state` import.

## Alternatives Considered

- Keep types in `src/lifecycle/model` indefinitely. Rejected: it preserves the reverse dependency L1 exists to remove.
- Move types into a generic `src/core/*.ts` runtime module or re-export from `src/core/index.ts`. Rejected: that is the P8 inversion and an SDK expansion.
- Introduce a third shared package for types. Rejected by ADR 0007: extra packages add release and compatibility cost the product does not need.
- Leave a re-export shim at `src/lifecycle/model.ts`. Rejected: it keeps the old path and looks like a leftover.

## Follow-up

- `runtime-boundaries` and `compatibility-contract` OpenSpec deltas in `lifecycle-model-core-internal-l1`.
- L2+ knives MUST NOT treat `src/core/lifecycle/` as a dump for remaining engines without their own change.
