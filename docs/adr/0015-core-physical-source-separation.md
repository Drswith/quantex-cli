# ADR 0015: Physical Core/CLI source separation

- Status: Accepted
- Date: 2026-09-17

## Context

ADR 0007 extracted `quantex-core` as an independently packable SDK while the CLI stayed the compatibility shell. ADRs 0011–0014 then internalized lifecycle types and engines under `src/core/lifecycle/` without expanding the published export surface.

That left a logical ownership boundary with an incomplete physical one: `packages/core/src` re-exported `../../../src/core`, CLI modules imported Core internals from root `src/core/**`, and Core still shared the root `src/` tree with CLI shell code. Issue #741 asks to finish the source split and make CLI → Core enforceable, without guessing a wide move of still-shared modules.

## Decision

- Core runtime implementation lives in `packages/core/src`. Root `src/core/` is absent after the move. Do not leave a re-export shim.
- Published `quantex-core` remains frozen: `createQuantex` plus the existing supported types. `quantex-core/internal` stays in-repo only.
- CLI may import Core. Core MUST NOT import CLI shell, presentation, commands, config, services, compatibility facades, idempotency, planning, inspection, `src/self`, or `src/runtime/cli-operation-context`.
- Agents, providers, state, package-manager, runtime ports (except CLI operation context), agent-update, and non-presentation utils stay in root `src/` as **documented neutral exceptions** until a later ownership knife.
- `src/state` and `src/package-manager/index.ts` MAY import only `packages/core/src/lifecycle/model.ts` (the zero-import type leaf from ADR 0011). They MUST NOT import Core runtime.
- `src/package-manager/index.ts` currently also imports CLI `cli-context` and `config`. That mixed coupling is a deferred split, not a reason to move package-manager into Core in this knife.
- Architecture tests, not comments, enforce direction, documented reverse edges, and the deferred package-manager exception allowlist.
- This ADR supersedes the **physical path** in ADRs 0011–0014 (`src/core/...` → `packages/core/src/...`). Those ADRs remain in force for leaf vs runtime, no lifecycle barrel, and unpublished engines.

## Consequences

- Contributors look in `packages/core/src` for Core engines and in root `src/` for CLI plus shared infrastructure.
- Import paths from Core into shared modules are explicit (`../../../src/...`) and reviewable.
- A later move of agents/providers/state/package-manager needs its own OpenSpec change; this directory is not a dump.
- Published SDK consumers and CLI JSON contracts are unchanged by the relocation.

## Alternatives Considered

- Keep re-exporting root `src/core` from `packages/core`. Rejected: that is the incomplete boundary #741 exists to remove.
- Move agents, providers, state, package-manager, and runtime into `packages/core` in the same knife. Rejected: ownership is mixed; package-manager/index is CLI-coupled; ADR 0007 rejected extra packages and a reckless monorepo split.
- Introduce a third shared package for types/infrastructure. Rejected by ADR 0007.
- Leave a `src/core` re-export shim for CLI convenience. Rejected: it preserves the old path and looks like a leftover.

## Follow-up

- OpenSpec change `core-physical-source-separation` (issue #741).
- Later knives may extract a Core-safe package-manager lock leaf or relocate a named shared module once product ownership is decided.
