# Design: relocate-core-state

## Context

ADR 0015 and archived OpenSpec `core-physical-source-separation` locked ownership:

- Core owns the lifecycle domain, provider adapters, persisted state, receipts, and similar shared modules.
- CLI owns commands, presentation, exit policy, and self-upgrade UI.
- Catalog (`src/agents`) and `packages/core/src/lifecycle/model.ts` are the documented **neutral boundary**.
- `src/state` stayed in root as a **deferred Core relocation** (exception, not CLI ownership).

Slice 1 (#752 / #753 / #754) moved package-manager and inverted its CLI seams. Slice 2 (#755 / #756 / #757) moved providers. Named state facts after those knives:

- State schema / store / file-store / convenience helpers live under root `src/state/**`.
- `src/state.ts` is the published v1 convenience barrel (S1 KEEP).
- State **value-imports** CLI `getConfigDir` from `src/config` and **type-imports** `SelfInstallSource` from `src/self/types`.
- State imports the lifecycle type-leaf, `packages/core/src/package-manager/managed-install-types.ts`, catalog `InstallType` / `PackageTargetKind`, and deferred Core `src/utils/lock`.
- Core engines, package-manager, and lifecycle helpers import state types and helpers from root `src/state`.
- Architecture tests currently record those CLI seams as the deferred-state exception and require `packages/core/src/state` to be absent.

Issue #759 is slice 3: physically relocate state into Core. Do not fold config. Do not start #134 or catalog slim-down.

## Goals / Non-Goals

**Goals:**

- Keep state **Core-owned**. Root `src/state/` placement today is the exception this knife removes.
- List every CLI edge to cut or invert. Do not reassign state to CLI because remaining lock/catalog edges exist.
- Place sources at `packages/core/src/state/**`. Delete root `src/state/`. Do not leave a directory re-export shim.
- Keep `src/state.ts` as the published v1 convenience barrel over the Core-owned tree.
- Architecture tests lock the new layout, forbid Core → CLI, allow deferred Core modules still in root to import the relocated tree, and keep type-leaf / catalog neutrality.
- Preserve state v2 / receipt JSON / `loadState` / lock path outcomes. Do not change those into CLI-side semantics.
- Keep published `quantex-core` frozen. Do not publish state.

**Non-Goals:**

- Folding `config` / capabilities / commands / schema.
- Starting #134 or catalog slim-down.
- New CLI commands or public SDK methods.
- Changing `--json` / aliases / exit codes / state v2 / receipts. JSON must not expose engine or route identifiers.
- YAML / workflow / `release-core.yml` / protect-main edits.
- A separate product release.
- Inverting deferred util CLI leaks (`src/utils/network` / `src/utils/lock` wrappers that still call `getConfigDir`). That is a later utils knife, not a reason to call state CLI-owned.

## Ownership / seam draft

Default owner is unchanged from ADR 0015. This knife only physically relocates state.

| Area | Default owner | This knife | Notes |
|---|---|---|---|
| `packages/core/src/state/**` | Core | **Moved** | Schema, store, file-store, convenience helpers, host ports. Unpublished. |
| `src/state.ts` | CLI published v1 facade | Stay (retarget) | KEEP barrel over Core state. Not a `src/state/` directory shim. |
| `packages/core/src/providers/**` | Core | Stay | Already Core-local. |
| `packages/core/src/package-manager/**` | Core | Stay | Already Core-local. Retarget state imports onto sibling `../state`. |
| `src/agents/**` | Neutral catalog boundary | Stay | Schema keeps importing catalog `InstallType` / `PackageTargetKind`. Not CLI-owned. |
| `packages/core/src/lifecycle/model.ts` | Neutral type-leaf | Stay | Relocated state MAY import this leaf among lifecycle modules. |
| Remaining deferred Core (`src/runtime` except CLI operation context / CLI host binders, `src/agent-update`, non-presentation utils) | Core | Stay (root exception) | May import relocated state, providers, and package-manager. Not CLI-owned. |
| `src/config/**`, `src/commands/**`, `src/self/**` (except the persisted source union) | CLI | Stay | CLI → Core imports of state remain allowed. Do not fold config. |
| `src/runtime/cli-state-host.ts`, `src/runtime/cli-package-manager-host.ts`, `src/runtime/cli-operation-context.ts` | CLI | Stay / add state binder | CLI binds Core-owned host ports. |

### CLI edges to cut or invert

Do **not** reassign state to CLI because remaining root edges exist. Invert only CLI-owned edges; keep deferred-Core / catalog edges as documented remaining root imports so outcomes stay frozen.

| Importer (today) | Edge | Kind | Resolution |
|---|---|---|---|
| `src/state/index.ts` | `getConfigDir` from `src/config` | CLI-owned | Invert: Core-owned `StateHostPorts.configDir()`, defaulting to the same `HOME`/`USERPROFILE`/`homedir()` + `.quantex` location convention already used by `resolveCoreConfigDir`. CLI binds `getConfigDir` via `src/runtime/cli-state-host.ts` (also from `src/state.ts` so tests that spy `getConfigDir` keep working). |
| `src/state/index.ts`, `src/state/schema.ts` | type-only `SelfInstallSource` from `src/self/types` | CLI-owned type of a persisted field | Invert: own `SelfInstallSource` on the Core state schema (same `'binary' \| 'bun' \| 'npm' \| 'source' \| 'unknown'` union). CLI `src/self/types` re-exports that type. Do not fold self-upgrade UI. |
| `src/state/index.ts` | `acquireResourceLock` / `getResourceLockPath` from `src/utils/lock` | Deferred Core utils (wrappers still call CLI `getConfigDir`) | Keep as documented Core → remaining-root import, but call `acquireResourceLockInConfigDir` / `getResourceLockPathInConfigDir` with the injected config dir so this knife does not pull CLI config through the lock wrappers. Do **not** start a lock/utils knife. |
| `src/state/schema.ts` | `src/agents/types` (`InstallType`, `PackageTargetKind`) | Neutral catalog | Keep. |
| `src/state/schema.ts` | `packages/core/src/package-manager/managed-install-types.ts` | Core-owned | Retarget to sibling `../package-manager/managed-install-types`. |
| `src/state/{schema,store,index}.ts` | `packages/core/src/lifecycle/model.ts` | Neutral type-leaf | Retarget to sibling `../lifecycle/model`. MUST NOT import other lifecycle engines, providers, `createQuantex`, or Core executors. |
| Core engines / package-manager / lifecycle helpers | root `src/state` | Core → deferred root | Retarget to sibling `packages/core/src/state`. |
| CLI services / commands / compatibility / `src/state.ts` | root `src/state` barrel | CLI → Core | Keep the published barrel; retarget its implementation import onto Core. |

No new public SDK method is required. Adding a state host just to move detection/version helpers is out of scope; the only CLI value edge is config-dir resolution.

### Reverse-import allowlist after the move

CLI-owned modules MAY import any Core-internal module, including state. The published barrel `src/state.ts` and `src/runtime/cli-state-host.ts` are CLI-owned for this purpose.

Deferred Core modules still in root (`src/agent-update`, non-presentation `src/utils`, runtime ports except CLI operation context / CLI host binders) MAY import `packages/core/src/state/**`, `packages/core/src/providers/**`, and `packages/core/src/package-manager/**`. That is Core → Core across the remaining root exception, not a CLI leak and not a license to import Core runtime engines (`createQuantex`, mutation/execution/self-upgrade/doctor executors, lifecycle engines other than the type-leaf).

Relocated state MUST import at most the type-leaf among lifecycle modules. It MAY additionally import `packages/core/src/package-manager/managed-install-types.ts`. It MUST NOT import providers, provider-binding, or Core runtime.

Catalog stays the documented neutral boundary and MUST NOT be labeled CLI-owned.

## Decisions

1. **Layout is `packages/core/src/state/**`.** Same tree as former `src/core/**` → `packages/core/src`, slice-1 package-manager, and slice-2 providers. Alternative: a new `packages/core/src/persisted-state/` name. Rejected: extra rename without ownership value.

2. **No `src/state/` directory shim.** CLI and tests import `packages/core/src/state` (or a file under it) or the published `src/state.ts` barrel. A `src/state/index.ts` re-export would preserve the deferred exception this knife exists to remove.

3. **Keep `src/state.ts`.** It is the documented S1 published v1 convenience barrel, not the implementation tree. Alternative: delete it and force every CLI importer onto `packages/core/src/state`. Rejected: that folds a frozen facade the leftover scan hangs as KEEP.

4. **Invert CLI config-dir via host ports.** Direct `src/config` specifiers would fail Core → CLI architecture tests. Default ports use the existing Core location convention (`HOME` / `USERPROFILE` / `homedir()` + `.quantex`) so SDK/Core callers without CLI bind keep the same path. CLI binds `getConfigDir` so spies and CLI config-dir resolution stay frozen. Alternative: duplicate `loadConfig` inside state. Rejected: that folds config.

5. **Own `SelfInstallSource` on the state schema.** It is a persisted-state discriminator, not self-upgrade UI. CLI re-exports the same union so `src/self` and the compatibility facade keep their types. Alternative: keep importing `src/self/types` from Core. Rejected: that is a Core → CLI leak. Alternative: a structurally identical but separate Core union mapped by CLI. Rejected: two sources of truth for a frozen discriminator.

6. **Published SDK stays frozen.** Do not export state from `packages/core/src/index.ts` or add a package subpath. `quantex-core/internal` stays in-repo only and does not grow state exports this knife.

7. **Architecture tests become the enforcement.** `src/state/` is absent. `packages/core/src/state` exists. Core specifiers MUST NOT match CLI shell paths, including from relocated state files. Remove `src/state/` from the Core root-import allowlist. Deferred Core root modules MAY import the relocated tree. Type-leaf and catalog rules stay.

8. **Changelog framing is internal architecture.** Commit as `chore(core):` / `docs(openspec):`. No separate release unless product says otherwise.

## Risks / Trade-offs

- [Risk] Tests that spy `config.getConfigDir` and then call `loadState` / `getStateFilePath` would miss a default host that only reads `HOME` → Mitigation: bind CLI host from `cli-context` and from `src/state.ts` so the spy still intercepts `getConfigDir`.
- [Risk] Relocated state importing Core runtime (`createQuantex`, executors, provider-binding) recreates the cycle ADR 0011 forbade → Mitigation: architecture tests still require state to import at most the type-leaf among lifecycle modules plus managed-install-types.
- [Risk] `SelfInstallSource` moving onto the schema retargets `dist/index.d.mts` `#region` paths → Mitigation: refresh the pinned v1 declaration snapshot only when bytes/digest change; do not add exports or change the union.
- [Risk] Relocating state under `packages/core/src/` makes those files sandbox-relevant via the existing `packages/core/src/` prefix → Mitigation: accept that Core-owned sources already trigger sandbox; do not add workflow YAML this knife.
- [Risk] Transitive CLI through `src/utils/lock` wrappers looks like a new Core leak → Mitigation: call the `*InConfigDir` helpers with the injected dir. Architecture tests continue to enforce **direct** specifiers only.

## Migration Plan

1. Land this OpenSpec change (proposal, this seam draft, spec deltas, tasks) and the ADR 0015 follow-up note.
2. `git mv src/state` → `packages/core/src/state`; add host ports; rewrite escaped imports; retarget CLI/Core/tests/scripts; keep `src/state.ts`.
3. Update architecture, leftover, ownership, and path assertions.
4. Run lint, format check, typecheck, tests, OpenSpec validate, and memory check.
5. Keep the PR **draft** against `main` referencing #759. Do not auto-ready. Do not cut a release.

Rollback is git revert of the migration commits. Public SDK and CLI contracts are unchanged.

## Open Questions

None for this knife. Later knives (not this PR):

- Optional later: invert deferred util CLI leaks (`src/utils/network`, `src/utils/lock` getConfigDir wrappers) without reassigning those utils to CLI.
- Do not start #134 or catalog slim-down here.
