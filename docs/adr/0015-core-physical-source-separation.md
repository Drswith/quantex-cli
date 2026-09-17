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
- Ambiguous remaining modules must be called out rather than guessed into a wide move.

## Decision

- Core runtime that is clear to move lives in `packages/core/src` (former `src/core/**`, including the lifecycle domain and receipt leaf). Root `src/core/` is absent after the move. Do not leave a re-export shim.
- Published `quantex-core` remains frozen: `createQuantex` plus the existing supported types. `quantex-core/internal` stays in-repo only. Do not publish providers, state, or receipts.
- CLI may import Core. Core MUST NOT import CLI commands, presentation, exit policy, config, services, compatibility facades, idempotency, planning, inspection, `src/self`, or `src/runtime/cli-operation-context`.
- `src/providers` and `src/state` are Core-owned logically. They stay in root `src/` this knife because of named physical stop points: providers import `src/package-manager/*` (ownership unlocked); state imports CLI `src/config` and `src/self/types`.
- `src/agents` remains the documented **neutral catalog boundary**. `packages/core/src/lifecycle/model.ts` remains the documented **type-leaf reverse-import boundary**. `src/state` and `src/package-manager/index.ts` MAY import that leaf only. They MUST NOT import Core runtime.
- `src/package-manager`, runtime ports except CLI operation context, and `src/agent-update` stay unlocked. `src/package-manager/index.ts` currently imports CLI `cli-context`, `config`, and `cli-operation-context`. That mixed coupling is a deferred split, not a reason to move package-manager into Core.
- Architecture tests, not comments, enforce direction, the type-leaf boundary, the deferred package-manager exception, and the provider/state stop points.
- Changelog framing is internal/architecture. No separate release unless product says otherwise.
- This ADR supersedes the **physical path** in ADRs 0011–0014 (`src/core/...` → `packages/core/src/...`). Those ADRs remain in force for leaf vs runtime, no lifecycle barrel, and unpublished engines.

## Consequences

- Contributors look in `packages/core/src` for Core engines and receipts, in root `src/` for CLI shell plus Core-owned modules that are physically blocked, and in `src/agents` for the neutral catalog.
- Import paths from Core into remaining root modules are explicit (`../../../src/...`) and reviewable.
- A later move of providers or state needs a product decision that lifts the named stop points; this directory is not a dump.
- Published SDK consumers and CLI JSON contracts are unchanged by the relocation.

## Alternatives Considered

- Keep re-exporting root `src/core` from `packages/core`. Rejected: that is the incomplete boundary #741 exists to remove.
- Move providers and state into `packages/core` in the same knife because product assigned Core ownership. Rejected: state imports CLI config/self; providers import unlocked package-manager. That would guess mixed seams.
- Move package-manager, runtime, and agent-update with providers. Rejected: product did not lock those owners.
- Introduce a third shared package for catalog/types/infrastructure. Rejected by ADR 0007.
- Leave a `src/core` re-export shim for CLI convenience. Rejected: it preserves the old path and looks like a leftover.

## Follow-up

- OpenSpec change `core-physical-source-separation` (issue #741).
- Later knives may relocate providers/state only after product decides the `SelfInstallSource` / config-dir and package-manager-leaf questions.
