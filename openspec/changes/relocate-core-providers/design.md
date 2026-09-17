# Design: relocate-core-providers

## Context

ADR 0015 and archived OpenSpec `core-physical-source-separation` locked ownership:

- Core owns the lifecycle domain, provider adapters, persisted state, receipts, and similar shared modules.
- CLI owns commands, presentation, exit policy, and self-upgrade UI.
- Catalog (`src/agents`) and `packages/core/src/lifecycle/model.ts` are the documented **neutral boundary**.
- `src/providers` stayed in root as a **deferred Core relocation** (exception, not CLI ownership).

Slice 1 (#752 / #753 / #754) moved package-manager to `packages/core/src/package-manager` and inverted its CLI seams. Named providers facts after that knife:

- Provider adapters value-import Core `packages/core/src/package-manager/{npm,brew,...}` and `context-mutation`.
- Provider adapters also import deferred Core utils (`src/utils/detect`, `src/utils/version`, `src/utils/registry`, `src/utils/child-process`) and the catalog type `src/agents/types`.
- Architecture tests already prove providers have **no** direct CLI shell imports (`cli-context`, commands, `self`, `config`).
- `src/utils/child-process.ts` value-imports `getProviderOutputPolicy` from providers; other deferred utils type-import `ProviderOperationContext`.
- CLI-owned modules (`src/services`, `src/self`, `src/idempotency`, `src/runtime/cli-operation-context`) import the providers barrel.

Issue #755 is slice 2: physically relocate providers into Core. Do not also move `src/state`. Do not start #134 or catalog slim-down.

## Goals / Non-Goals

**Goals:**

- Keep providers **Core-owned**. Root placement today is the exception this knife removes.
- List every CLI edge to cut or invert. Do not reassign providers to CLI because remaining util edges exist.
- Place sources at `packages/core/src/providers/**`. Delete root `src/providers`. Do not leave a re-export shim.
- Architecture tests lock the new layout, forbid Core → CLI, allow deferred Core modules still in root to import the relocated tree, and keep type-leaf / catalog neutrality.
- Preserve provider install/update/uninstall/observe outcomes. Do not change those into CLI-side semantics.
- Keep published `quantex-core` frozen. Do not publish providers.

**Non-Goals:**

- Moving `src/state` (slice 3 later).
- Starting #134 or catalog slim-down.
- New CLI commands or public SDK methods.
- Changing `--json` / aliases / exit codes / state v2 / receipts. JSON must not expose engine or route identifiers.
- YAML / workflow / `release-core.yml` / protect-main edits.
- A separate product release.
- Inverting deferred Core utils (`src/utils/network` still imports CLI `cli-context` / `config`). That is a later utils/state seam, not a providers CLI import.

## Ownership / seam draft

Default owner is unchanged from ADR 0015. This knife only physically relocates providers.

| Area | Default owner | This knife | Notes |
|---|---|---|---|
| `packages/core/src/providers/**` | Core | **Moved** | Types, registry, invoke, first-party adapters. Unpublished. |
| `packages/core/src/package-manager/**` | Core | Stay | Already Core-local. Adapters retarget onto sibling `../package-manager`. |
| `src/state/**` | Core | Deferred relocation (root exception) | Still imports CLI `src/config` / `src/self/types`. Still may import the type-leaf. Do not move this knife. |
| `src/agents/**` | Neutral catalog boundary | Stay | `install-effect.ts` keeps importing catalog `Platform`. Not CLI-owned. |
| `packages/core/src/lifecycle/model.ts` | Neutral type-leaf | Stay | Unchanged. |
| Remaining deferred Core (`src/runtime` except CLI operation context, `src/agent-update`, non-presentation utils) | Core | Stay (root exception) | May import relocated providers and package-manager. Not CLI-owned. |
| `src/runtime/cli-operation-context.ts`, `src/services/**`, `src/self/**`, `src/idempotency/**` | CLI | Stay | CLI → Core imports of providers remain allowed. |

### CLI edges to cut or invert

Providers currently has **no direct CLI shell imports**. Do **not** reassign it to CLI because remaining root edges exist. Invert only if an edge is CLI-owned; keep deferred-Core / catalog edges as documented remaining root imports so outcomes stay frozen.

| Importer (today) | Edge | Kind | Resolution |
|---|---|---|---|
| `adapters/*` | `packages/core/src/package-manager/*` | Core-owned | Retarget to sibling `../package-manager`. Not a CLI seam. |
| `adapters/*` | `src/utils/detect`, `version`, `registry`, `child-process` | Deferred Core utils (not CLI) | Keep as documented Core → remaining-root imports. Do **not** rewrite adapters to call `getCliContext` / `loadConfig` / `cli-child-process`. |
| `adapters/install-effect.ts` | `src/agents/types` (`Platform`) | Neutral catalog | Keep. |
| `src/utils/child-process.ts` | value-import `getProviderOutputPolicy` | Deferred Core reverse import | Allowlist `packages/core/src/providers/**` for deferred Core root modules (same pattern as package-manager). Do not duplicate the helper into CLI. |
| `src/utils/{detect,version,network,executable-resolution}.ts` | type-only `ProviderOperationContext` | Deferred Core reverse import | Same providers allowlist. |
| `src/agent-update/self-update.ts` | type-only provider types | Deferred Core reverse import | Same providers allowlist. |
| `src/runtime/cli-operation-context.ts` | provider context types | CLI-owned | CLI → Core. Keep. |
| `src/services/*`, `src/self/*`, `src/idempotency/*` | registry / first-party barrel | CLI-owned | CLI → Core. Keep. |
| `src/utils/network.ts` | `cli-context` / `config` | CLI leak **inside deferred utils**, not a providers import | Out of scope. Do not start a utils/state knife here. |

No new host-port binder is required for this knife. Slice 1 already inverted the CLI seams that lived in package-manager. Adding a providers host just to move detection/version helpers would change unpublished call shape without changing frozen CLI outcomes.

### Reverse-import allowlist after the move

CLI-owned modules MAY import any Core-internal module, including providers.

Deferred Core modules still in root (`src/state`, `src/agent-update`, non-presentation `src/utils`, runtime ports except CLI operation context) MAY import `packages/core/src/providers/**` and `packages/core/src/package-manager/**`. That is Core → Core across the remaining root exception, not a CLI leak and not a license to import Core runtime engines (`createQuantex`, mutation/execution/self-upgrade/doctor executors, lifecycle engines other than the type-leaf).

`src/state` MUST still import at most the type-leaf among lifecycle modules. It MAY additionally import `packages/core/src/package-manager/managed-install-types.ts`. It MUST NOT import providers as a way to pull Core runtime.

Catalog stays the documented neutral boundary and MUST NOT be labeled CLI-owned.

## Decisions

1. **Layout is `packages/core/src/providers/**`.** Same tree as former `src/core/**` → `packages/core/src` and slice-1 package-manager. Alternative: a new `packages/core/src/provider-adapters/` name. Rejected: extra rename without ownership value.

2. **No root shim.** CLI and tests import `packages/core/src/providers` (or a file under it). A `src/providers` re-export would preserve the deferred exception this knife exists to remove.

3. **No new host-port inversion this knife.** Direct CLI specifiers are already absent. Remaining edges are deferred Core utils and the catalog. Alternative: inject detect/version/spawn through new ports. Rejected: that would churn unpublished adapter constructors into CLI-side wiring without a frozen-contract change.

4. **Allowlist deferred Core → relocated providers.** Needed because `src/utils/child-process.ts` value-imports `getProviderOutputPolicy` and several deferred modules type-import provider context. Architecture tests already ignore type-only vs value for reverse imports. Alternative: duplicate the three-line helper into utils. Rejected: it splits Core-owned policy without removing the type reverse import.

5. **Published SDK stays frozen.** Do not export providers from `packages/core/src/index.ts` or add a package subpath. `quantex-core/internal` stays in-repo only and does not grow provider exports this knife. Keep `first-party.ts` outside the public eager and complete closures.

6. **Architecture tests become the enforcement.** `src/providers` is absent. `packages/core/src/providers` exists. Core specifiers MUST NOT match CLI shell paths, including from relocated provider files. Remove `src/providers/` from the Core root-import allowlist. Deferred Core root modules MAY import the relocated tree. Type-leaf and catalog rules stay. `src/state` remains the recorded deferred root exception.

7. **Changelog framing is internal architecture.** Commit as `chore(core):` / `docs(openspec):`. No separate release unless product says otherwise.

## Risks / Trade-offs

- [Risk] Deferred utils importing Core providers look like a forbidden reverse import of Core runtime → Mitigation: spec and architecture tests allowlist `packages/core/src/providers/**` for deferred Core root modules, still forbidding executors / `createQuantex` / lifecycle engines other than the type-leaf.
- [Risk] `first-party.ts` is pulled into the public SDK complete closure via adapter or capabilities imports → Mitigation: keep public complete closure on installer leaves used by `installation-provider-registry`, not `first-party.ts` / `package-manager/capabilities.ts`. Continue asserting `packages/core/src/providers/first-party.ts` stays outside that closure.
- [Risk] Relocating providers under `packages/core/src/` makes those files sandbox-relevant via the existing `packages/core/src/` prefix → Mitigation: accept that Core-owned sources already trigger sandbox; do not add workflow YAML this knife.
- [Risk] Transitive CLI through `src/utils/version` → `src/utils/network` (`cli-context` / `config`) looks like a new Core leak → Mitigation: architecture tests continue to enforce **direct** specifiers only, matching slice 1. Do not invert network in this PR.
- [Risk] Later state move copies this layout without checking remaining CLI seams → Mitigation: Core MUST NOT import `src/self` or `src/config`; a naive `src/state` move still fails those tests.

## Migration Plan

1. Land this OpenSpec change (proposal, this seam draft, spec deltas, tasks) and the ADR 0015 follow-up note.
2. `git mv src/providers` → `packages/core/src/providers`; rewrite escaped imports; retarget CLI/Core/tests/scripts.
3. Update architecture, leftover, ownership, and path assertions.
4. Run lint, format check, typecheck, tests, OpenSpec validate, and memory check.
5. Keep the PR **draft** against `main` referencing #755. Do not auto-ready. Do not cut a release.

Rollback is git revert of the migration commits. Public SDK and CLI contracts are unchanged.

## Open Questions

None for this knife. Later knives (not this PR):

- Slice 3: `src/state` → Core after CLI config/self edges are cleaned.
- Optional later: invert deferred util CLI leaks (`src/utils/network`) without reassigning those utils to CLI.
