# Design: core-physical-source-separation

## Context

At the 1.13.6 line, `packages/core` is a workspace and distribution package. This knife physically moves Core runtime from root `src/core/**` into `packages/core/src` and stops package re-exports of `../../../src/core`.

Product locked ownership for #741:

- Core owns the lifecycle domain, provider adapters, persisted state, and receipts.
- CLI owns commands, presentation, exit policy, and self-upgrade UI.
- Shared catalog and the lifecycle type-leaf stay a documented **neutral boundary**.
- Deferred shared modules that remain in root `src/` keep Core as the default owner. Temporary root placement is an exception, not a reassignment to CLI.

Investigation after that lock: receipt types and lifecycle engines already live under `packages/core/src/lifecycle/`. `src/state` still value-imports CLI `src/config` and `src/self/types`. `src/providers` adapters value-import `src/package-manager/*`, whose `index.ts` is still CLI-coupled. Those are physical seams. Default ownership for providers, state, package-manager, and similar shared modules remains Core; this knife defers their relocation and records the root placement as an exception.

## Goals / Non-Goals

**Goals:**

- Record the product-locked ownership table, including physical stop points.
- `packages/core/src` owns Core runtime implementation that is already clear to move (former `src/core/**`, including lifecycle domain and receipts). Package entries no longer re-export root `src/core`.
- Root `src/core` contains no Core runtime implementation.
- CLI depends on Core through the public SDK entry and the in-repo internal/package source bridge.
- Architecture tests prove CLI → Core, reject Core → CLI shell, reject undocumented cycles, allow the documented type-leaf reverse-import boundary, and record deferred Core relocation of providers/state/package-manager as a root exception rather than CLI ownership.
- Preserve lazy mutation loading, Core package constraints, CLI compatibility output, and no-engine/no-route public payloads.

**Non-Goals:**

- Expanding the published `quantex-core` export surface or adding CLI commands.
- Changing agent lifecycle behavior, `--json` schema, aliases, exit codes, state v2, or receipt JSON.
- Physically relocating `src/providers`, `src/state`, `src/package-manager`, or similar shared modules in this knife (default owner remains Core; root placement is a temporary exception).
- Reassigning those deferred modules to CLI because they still live under root `src/`.
- Splitting `src/package-manager/index.ts` off `cli-context` / `config` in this knife (CLI coupling is a seam to lift later, not CLI ownership of package-manager).
- Merging catalog slim / #134, YAML / `.github/workflows` / `release-core.yml` edits, or cutting a release.
- Restoring `src/lifecycle/` or adding a Core lifecycle barrel.

## Ownership table

Default owner is the product principle. Physical location this knife is separate: only former `src/core/**` moves. Deferred shared modules that remain under root `src/` keep Core as the default owner (lifecycle / provider / state / receipt and similar). Temporary root placement is an **exception**, not a reassignment to CLI. Catalog and the type-leaf stay the documented **neutral boundary**.

| Area | Default owner | This knife | Notes |
|---|---|---|---|
| `packages/core/src/**` except providers/state (former `src/core/**`) | Core | Moved | Lifecycle domain, receipts, mutation/execution/doctor/self-upgrade engines. Public entry remains `createQuantex` + supported types. |
| `packages/core/src/lifecycle/model.ts` | Core (receipt / type leaf) | Moved with Core | Zero-import leaf. **Neutral reverse-import boundary:** `src/state` and `src/package-manager/index.ts` MAY import it. MUST NOT import Core runtime. Root placement of importers is an exception, not CLI ownership of the leaf. |
| Other `packages/core/src/lifecycle/*` | Core (lifecycle domain) | Moved with Core | No barrel. CLI/services/idempotency MAY import directly. `src/state` MUST NOT. |
| `src/providers/**` | Core | Deferred relocation (root exception) | Default owner remains Core. Adapters still import `src/package-manager/*`; that seam defers the physical move. Eager public Core closure still MUST NOT load `first-party.ts`. Root placement is not CLI ownership. |
| `src/state/**` | Core | Deferred relocation (root exception) | Default owner remains Core. `index.ts` still imports CLI `src/config` (`getConfigDir`) and `src/self/types` (`SelfInstallSource`); `schema.ts` also imports `SelfInstallSource`. Reverse edge onto the type leaf only. Root placement is not CLI ownership. |
| `src/package-manager/**` | Core | Deferred relocation (root exception) | Default owner remains Core. `index.ts` currently imports CLI `cli-context`, `config`, and `cli-operation-context`; that coupling is a seam to lift, not a reassignment of package-manager to CLI. |
| `src/runtime/**` except CLI operation context | Core | Deferred relocation (root exception) | Default owner remains Core. Process/cache/network/lock ports. Temporary root placement is an exception, not CLI ownership. |
| `src/agent-update/**` | Core | Deferred relocation (root exception) | Default owner remains Core. Used by Core update production and CLI projectors. Temporary root placement is an exception, not CLI ownership. |
| Remaining non-presentation `src/utils/**` | Core | Deferred relocation (root exception) | Default owner remains Core. Presentation utils are listed separately as CLI. |
| `src/agents/**` | Neutral catalog boundary | Deferred relocation (root exception) | Documented **neutral boundary** (not CLI-owned). Temporary root placement is an exception, not a reassignment to CLI. Used by CLI compatibility and Core. |
| `src/commands/**`, `src/cli.ts`, `src/cli-context.ts`, `src/command-runtime.ts`, `src/command-contract/**`, `src/output/**` | CLI (commands / presentation / exit policy) | Stay (CLI shell) | Core MUST NOT import. |
| `src/self/**` | CLI (self-upgrade UI) | Stay (CLI shell) | Core self-upgrade executor consumes injected ports only. State currently type-imports `SelfInstallSource` from here — that seam defers moving state, and does not make state CLI-owned. |
| `src/services/**`, `src/compatibility/**`, `src/idempotency/**`, `src/planning/**`, `src/inspection/**`, `src/config/**` | CLI | Stay (CLI shell) | Bridges/projectors over Core. `src/config` is also the state `getConfigDir` seam. |
| `src/runtime/cli-operation-context.ts` | CLI | Stay (CLI shell) | Core MUST NOT import this file or value-import the `src/runtime` barrel that re-exports it. |
| `src/utils/user-output.ts`, `src/utils/color.ts`, `src/utils/cli-child-process.ts` | CLI presentation | Stay (CLI shell) | Core MUST NOT import. |

### Physical stop points (deferred relocation, not CLI reassignment)

1. **`src/state` stays in root this knife.** Default owner remains Core. It still imports CLI `src/config` and `src/self/types`. Lift those seams (for example by moving `SelfInstallSource` into Core state schema and injecting config-dir as a port) before a physical relocation. Root placement is an exception, not CLI ownership of state.

2. **`src/providers` stays in root this knife.** Default owner remains Core. Adapters still import `src/package-manager/{npm,brew,...}` and `context-mutation`. Lift that installer seam before relocating providers. Root placement is an exception, not CLI ownership of providers.

3. **`src/package-manager`, runtime ports except CLI operation context, `src/agent-update`, and similar shared modules stay in root this knife.** Default owner remains Core. `package-manager/index.ts` still has a CLI-coupling allowlist; that is a deferred split of a seam, not a statement that package-manager is CLI-owned. Architecture tests keep that allowlist.

## Decisions

1. **Minimal first knife: move only former `src/core/**`.** Receipts and the lifecycle domain are already in that tree and are clear to relocate. Providers, state, package-manager, and similar shared modules keep Core as the default owner; this knife defers their relocation and records root placement as an exception. Alternative: big-bang move in the same knife. Rejected: that would drag CLI config/self coupling into the Core package before the seams are lifted.

2. **No root `src/core` shim.** After the move, CLI and tests import `packages/core/src/**` (or `quantex-core` / `quantex-core/internal`). A re-export shim would preserve the incomplete physical boundary this knife exists to remove.

3. **Keep published exports frozen.** `packages/core/package.json` still exports only `.` and `./package.json`. `quantex-core/internal` remains an in-repo alias, not a published subpath. CLI-facing engines stay unpublished. Do not publish providers, state, or receipts.

4. **Preserve intra-Core relative imports.** Only imports that previously escaped `src/core` into root `src/<shared>` are rewritten to `../../../src/<shared>` (depth-adjusted). Generated catalog import paths update the same way.

5. **Architecture tests become the enforcement.** Direct Core specifiers MUST NOT match CLI shell paths. Reverse imports into Core from `src/` MUST land only on the documented model leaf, except CLI shell modules which MAY import any Core-internal module. Cycles through Core runtime (not the leaf) are forbidden. Transitive Core → `package-manager/index` → `cli-context` is an allowlisted deferred seam, not CLI ownership of package-manager. Tests MUST also record that deferred Core modules remain outside `packages/core/src` this knife.

6. **Type-only runtime barrel imports are retargeted.** Core type-imports `src/runtime/ports` (and invocation-context if needed) so the specifier graph does not name the CLI operation-context module.

7. **Core does not read CLI config.** `loadProductionCoreUpdatePorts` defaults `npmBunUpdateStrategy` to `latest-major` (the frozen config default). CLI production already injects the user-config value. This removes a direct Core → `src/config` edge without changing CLI update behavior.

8. **Changelog framing is internal architecture.** Commit as `chore(core):` / `docs(openspec):` so release-please does not invent a user-facing feature. No separate release unless product says otherwise. Behavior and schema stay frozen.

## Risks / Trade-offs

- [Risk] Deferred Core modules that still live under root `src/` look CLI-owned → Mitigation: OpenSpec/ADR say default owner remains Core; root placement is an exception; architecture tests assert they have not been moved.
- [Risk] A later contributor moves providers/state without splitting the CLI seams → Mitigation: Core MUST NOT import `src/self` or `src/config`; a naive move would fail those tests.
- [Risk] Shared-module relative imports (`../../../src/agents`) look like Core still lives in the CLI tree → Mitigation: catalog is the documented neutral boundary; other deferred modules are allowlisted as Core-owned root exceptions.
- [Risk] Eager/lazy mutation closure drifts → Mitigation: keep the existing runtime-closure architecture assertions, including `first-party.ts` exclusion.
- [Risk] Transitive package-manager CLI coupling is mistaken for CLI ownership of package-manager → Mitigation: name it as a deferred Core relocation seam in tests, design, and PR body.

## Migration Plan

1. Land the product-locked ownership table in this OpenSpec change and ADR 0015 before expanding the move.
2. `git mv` former `src/core` implementation into `packages/core/src`, replace package re-exports with local entries, rewrite escaped imports, retarget CLI/tests/scripts.
3. Update architecture, leftover, and ownership tests, including product-lock stop points.
4. Run lint, format check, typecheck, tests, OpenSpec validate, and memory check.
5. Keep the PR **draft** against `main` referencing #741. Do not auto-ready. Do not cut a release.

Rollback is git revert of the migration commit. Public SDK and CLI contracts are unchanged, so callers of published artifacts are unaffected.

## Open Questions

Physical-relocation seams to lift later (default owner remains Core; these are not CLI reassignment questions):

- How `SelfInstallSource` leaves `src/self/types` and how state config-dir resolution is injected as a port, so `src/state` can physically relocate into `packages/core`.
- How `src/package-manager` installer leaves and the CLI-coupled `index.ts` split, so providers and package-manager can physically relocate.
- When runtime ports and `src/agent-update` physically relocate into the Core package tree. Catalog and the type-leaf stay the documented neutral boundary.
