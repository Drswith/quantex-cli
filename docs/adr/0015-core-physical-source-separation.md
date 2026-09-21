# ADR 0015: Physical Core/CLI source separation

- Status: Accepted
- Date: 2026-09-17

## Context

ADR 0007 extracted `quantex-core` as an independently packable SDK while the CLI stayed the compatibility shell. ADRs 0011–0014 then internalized lifecycle types and engines under `src/core/lifecycle/` without expanding the published export surface.

That left a logical ownership boundary with an incomplete physical one: `packages/core/src` re-exported `../../../src/core`, CLI modules imported Core internals from root `src/core/**`, and Core still shared the root `src/` tree with CLI shell code. Issue #741 asks to finish the source split and make CLI → Core enforceable.

Product locked ownership for that issue:

- Core owns the lifecycle domain, provider adapters, persisted state, and receipts.
- CLI owns commands, presentation, exit policy, and self-upgrade UI.
- Shared catalog (`src/agents`) and the lifecycle type-leaf are a neutral boundary.
- Ambiguous remaining **physical** seams must be called out rather than guessed into a wide move. Deferred shared modules are not reassigned to CLI because they still live under root `src/`.

## Decision

- Core runtime that is clear to move lives in `packages/core/src` (former `src/core/**`, including the lifecycle domain and receipt leaf). Root `src/core/` is absent after the move. Do not leave a re-export shim.
- Published `quantex-core` remains frozen: `createQuantex` plus the existing supported types. `quantex-core/internal` stays in-repo only. Do not publish providers, state, or receipts.
- CLI may import Core. Core MUST NOT import CLI commands, presentation, exit policy, config, services, compatibility facades, idempotency, planning, inspection, `src/self`, or `src/runtime/cli-operation-context`.
- `src/providers`, `src/state`, `src/package-manager`, and similar shared modules keep Core as the default owner (lifecycle domain / provider / state / receipt). This knife **defers relocation**; temporary root placement is an exception, not a reassignment to CLI. Named seams: providers still import `src/package-manager/*`; state still imports CLI `src/config` and `src/self/types`; `src/package-manager/index.ts` still imports CLI `cli-context` / `config`. Those seams do not make the modules CLI-owned.
- `src/agents` remains the documented **neutral catalog boundary**. `packages/core/src/lifecycle/model.ts` remains the documented **type-leaf reverse-import boundary**. Neither boundary is CLI ownership. `src/state` and `src/package-manager/index.ts` MAY import that leaf only. They MUST NOT import Core runtime.
- Runtime ports except CLI operation context, and `src/agent-update`, follow the same deferred-Core rule. Do not label them CLI-owned because they remain in root `src/` this knife.
- Architecture tests, not comments, enforce direction, the type-leaf boundary, the deferred package-manager seam, and deferred Core relocation of providers/state/package-manager without treating root placement as CLI ownership.
- Changelog framing is internal/architecture. No separate release unless product says otherwise.
- This ADR supersedes the **physical path** in ADRs 0011–0014 (`src/core/...` → `packages/core/src/...`). Those ADRs remain in force for leaf vs runtime, no lifecycle barrel, and unpublished engines.

## Consequences

- Contributors look in `packages/core/src` for relocated Core engines and receipts, in root `src/` for CLI shell plus **deferred Core** modules whose relocation is an exception this knife, and in `src/agents` for the neutral catalog boundary.
- Import paths from Core into remaining root modules are explicit (`../../../src/...`) and reviewable.
- A later physical move of providers, state, or package-manager lifts named seams; it does not re-decide ownership away from Core. This directory is not a dump.
- Published SDK consumers and CLI JSON contracts are unchanged by the relocation.

## Alternatives Considered

- Keep re-exporting root `src/core` from `packages/core`. Rejected: that is the incomplete boundary #741 exists to remove.
- Move providers and state into `packages/core` in the same knife because product assigned Core ownership. Rejected for this knife: state still imports CLI config/self; providers still import package-manager. Those are physical seams, not a reason to call the modules CLI-owned.
- Move package-manager, runtime, and agent-update with providers in the same knife. Rejected for this knife: relocation is deferred. Default owner remains Core; root placement is an exception, not CLI ownership.
- Introduce a third shared package for catalog/types/infrastructure. Rejected by ADR 0007.
- Leave a `src/core` re-export shim for CLI convenience. Rejected: it preserves the old path and looks like a leftover.

## Follow-up

- OpenSpec change `core-physical-source-separation` (issue #741) archived via #751.
- Slice 1 (issue #752 / OpenSpec `relocate-core-package-manager`): package-manager lives at `packages/core/src/package-manager`. CLI `cli-context` / `config` / `cli-operation-context` / `cli-child-process` edges are inverted through Core-owned host ports bound by `src/runtime/cli-package-manager-host.ts`. Published `quantex-core` stays frozen and does not export package-manager.
- Slice 2 (issue #755 / OpenSpec `relocate-core-providers`): providers live at `packages/core/src/providers`. Direct CLI shell imports were already absent; remaining deferred-Core util and catalog edges stay documented root imports and are not rewritten into CLI-side semantics. Published `quantex-core` stays frozen and does not export providers. `src/state` remains the deferred Core root exception until slice 3.
- Slice 3 (issue #759 / OpenSpec `relocate-core-state`): state lives at `packages/core/src/state`. CLI `getConfigDir` is inverted through Core-owned host ports bound by `src/runtime/cli-state-host.ts`. Persisted `SelfInstallSource` is owned by the state schema and re-exported from CLI `src/self/types`. The published v1 barrel `src/state.ts` remains; root `src/state/` does not. Published `quantex-core` stays frozen and does not export state. Remaining deferred Core modules (`src/agent-update`, non-presentation utils, runtime ports except CLI operation context / CLI host binders) stay in root as exceptions, not CLI ownership. Product scope lock: relocate **only** `src/state` this knife; catalog / agents / type-leaf stay the documented neutral boundary; CLI seams invert/inject and MUST NOT become CLI-side lock/config semantics; `--json` / state v2 / receipts / public SDK frozen; changelog internal; no separate release; do not fold config; do not start #134 or catalog slim-down; keep the delivery PR draft until green.
- Later knives may physically relocate remaining shared modules still in root. Default owner remains Core. Catalog and the type-leaf stay the documented neutral boundary. Do not fold config.
