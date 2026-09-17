# Design: relocate-core-package-manager

## Context

ADR 0015 and archived OpenSpec `core-physical-source-separation` locked ownership:

- Core owns the lifecycle domain, provider adapters, persisted state, receipts, and similar shared modules.
- CLI owns commands, presentation, exit policy, and self-upgrade UI.
- Catalog (`src/agents`) and `packages/core/src/lifecycle/model.ts` are the documented **neutral boundary**.
- `src/package-manager` stayed in root as a **deferred Core relocation** (exception, not CLI ownership).

Named package-manager seams from that knife:

- Provider adapters value-import `src/package-manager/{npm,brew,...}` and `context-mutation`.
- `src/package-manager/index.ts` value-imports CLI `cli-context`, `config`, and `cli-operation-context`.
- `src/package-manager/binary.ts` value-imports CLI presentation `src/utils/cli-child-process`.
- `src/package-manager/installers.ts` and `mutation-outcome.ts` create CLI operation context when callers omit a provider context.
- Architecture tests allowlisted Core → `src/package-manager/index.ts` as a deferred transitive CLI coupling, not as CLI ownership.

Issue #752 is slice 1: physically relocate package-manager into Core and lift those CLI seams. Do not also move `src/providers` or `src/state`.

## Goals / Non-Goals

**Goals:**

- Keep package-manager **Core-owned**. Root placement today is the exception this knife removes.
- Cut or invert every CLI shell edge so `packages/core/src/package-manager/**` does not import `cli-context`, `config`, `cli-operation-context`, or `cli-child-process`.
- Place sources at `packages/core/src/package-manager/**`. Delete root `src/package-manager`. Do not leave a re-export shim.
- Architecture tests lock the new layout, forbid Core → CLI, allow deferred Core modules still in root to import the relocated tree, and keep type-leaf / catalog neutrality.
- Preserve CLI install/update/uninstall behavior when the CLI binder is installed (cancellation, config preferences, output policy, binary-shell spawn).
- Keep published `quantex-core` frozen. Do not publish package-manager.

**Non-Goals:**

- Moving `src/providers` or `src/state` (later knives).
- Starting #134 or catalog slim-down.
- New CLI commands or public SDK methods.
- Changing `--json` / aliases / exit codes / state v2 / receipts. JSON must not expose engine or route identifiers.
- YAML / workflow / `release-core.yml` / protect-main edits.
- A separate product release.

## Ownership / seam draft

Default owner is unchanged from ADR 0015. This knife only physically relocates package-manager.

| Area | Default owner | This knife | Notes |
|---|---|---|---|
| `packages/core/src/package-manager/**` | Core | **Moved** | Installer leaves, capabilities, managed-install types, agent install/update/uninstall orchestration. Unpublished. |
| `packages/core/src/package-manager/host.ts` | Core | **Added** | Host-port leaf. No CLI imports. Defaults match frozen config (`bun`, `latest-major`) and a CLI-free operation context. |
| `src/runtime/cli-package-manager-host.ts` | CLI | **Added** | CLI binder. Reads `cli-context` / `loadConfig` / `createCliOperationContext` / `cli-child-process` and installs Core host ports. |
| `src/cli-context.ts` | CLI | Stay; binds host | Installing CLI context also binds package-manager host ports (live reads, not a snapshot). |
| `src/providers/**` | Core | Deferred relocation (root exception) | Adapters retarget onto `packages/core/src/package-manager/*`. Still not CLI-owned. Do not move this knife. |
| `src/state/**` | Core | Deferred relocation (root exception) | `schema.ts` retargets `managed-install-types`. Still imports CLI `src/config` / `src/self/types`. Still may import the type-leaf. Do not move this knife. |
| `src/agents/**` | Neutral catalog boundary | Stay | Unchanged. |
| `packages/core/src/lifecycle/model.ts` | Neutral type-leaf | Stay | Package-manager (now Core-local) imports it as a sibling. Root `src/state` still MAY import the leaf only among lifecycle modules. |
| Remaining deferred Core (`src/runtime` except CLI operation context, `src/agent-update`, non-presentation utils) | Core | Stay (root exception) | May import relocated package-manager. Not CLI-owned. |

### CLI edges to cut or invert

Do **not** reassign package-manager to CLI because these edges exist. Invert them.

| Importer (today) | CLI edge | Resolution |
|---|---|---|
| `index.ts` | `getCliContext()` (`cancelled`, `timeoutMs`) | Host `isCancelled()` / `timeoutMs()`. CLI binder live-reads `getCliContext()`. |
| `index.ts` | `loadConfig()` (`defaultPackageManager`, `npmBunUpdateStrategy`) | Host `loadPreferences()`. CLI binder calls `loadConfig()`. Core default host uses frozen config defaults. |
| `index.ts`, `installers.ts` | type-only `NpmBunUpdateStrategy` from `src/config` | Use `RegistryPackageUpdateStrategy` from provider types (same union). |
| `index.ts`, `installers.ts`, `mutation-outcome.ts` | `createCliOperationContext()` | Host `createOperationContext()`. CLI binder delegates to `createCliOperationContext()`. |
| `index.ts` | `resolveCliProviderOutputPolicy` | Host `outputPolicy()`. CLI binder uses the CLI helper. |
| `binary.ts` | `src/utils/cli-child-process` | Host `runShellCommand()`. CLI binder uses `spawnWithQuantexStdio` / `waitForSpawnedCommand`. |

### Reverse-import allowlist after the move

CLI-owned modules MAY import any Core-internal module, including package-manager.

Deferred Core modules still in root (`src/providers`, `src/state`, `src/agent-update`, non-presentation `src/utils`, runtime ports except CLI operation context) MAY import `packages/core/src/package-manager/**`. That is Core → Core across the remaining root exception, not a CLI leak and not a license to import Core runtime engines (`createQuantex`, mutation/execution/self-upgrade/doctor executors, lifecycle engines other than the type-leaf).

`src/state` MUST still import at most the type-leaf among lifecycle modules. It MAY additionally import `packages/core/src/package-manager/managed-install-types.ts` (the same frozen type list it already used from root).

Catalog stays the documented neutral boundary and MUST NOT be labeled CLI-owned.

## Decisions

1. **Layout is `packages/core/src/package-manager/**`.** Same tree as former `src/core/**` → `packages/core/src`. Alternative: a new `packages/core/src/installers/` name. Rejected: extra rename without ownership value.

2. **No root shim.** CLI and tests import `packages/core/src/package-manager` (or a file under it). A `src/package-manager` re-export would preserve the deferred exception this knife exists to remove.

3. **Host-port inversion, not parameter plumbing on every installer.** Call sites (`installAgent`, provider adapters, smokes) stay signature-stable. CLI installs ports when `cli-context` is loaded/set. Alternative: require `ProviderOperationContext` on every function. Rejected this knife: it would churn the unpublished installer API and the published v1 compatibility re-exports without changing user-visible CLI contracts.

4. **CLI binder live-reads CLI context.** `setCliContext` / module load binds the same port object; `isCancelled()` reads current `getCliContext().cancelled`. `resetCliContext` does not uninstall the CLI binder, because the binder is a process adapter. Unbound Core defaults exist for SDK/Core-only graphs that never import `cli-context`.

5. **Published SDK stays frozen.** Do not export package-manager from `packages/core/src/index.ts` or add a package subpath. `quantex-core/internal` stays in-repo only and does not grow package-manager exports this knife.

6. **Architecture tests become the enforcement.** `src/package-manager` is absent. `packages/core/src/package-manager` exists. Core specifiers MUST NOT match CLI shell paths, including from relocated package-manager files. The old Core → `src/package-manager/index` allowlist is removed. Deferred Core root modules MAY import the relocated tree. Type-leaf and catalog rules stay.

7. **Changelog framing is internal architecture.** Commit as `chore(core):` / `docs(openspec):`. No separate release unless product says otherwise.

## Risks / Trade-offs

- [Risk] Direct Core/SDK callers that never import `cli-context` stop reading `~/.quantex/config.json` for installer preference → Mitigation: CLI path binds `loadConfig`; Core default host uses the same frozen defaults as `defaultConfig`. Direct tests that spy `loadConfig` keep working when they import `cli-context` (existing package-manager tests already do).
- [Risk] Deferred providers importing Core package-manager look like a forbidden reverse import of Core runtime → Mitigation: spec and architecture tests allowlist `packages/core/src/package-manager/**` for deferred Core root modules, still forbidding executors / `createQuantex` / lifecycle engines other than the type-leaf.
- [Risk] `capabilities.ts` → `src/providers/first-party.ts` is pulled into the public SDK complete closure → Mitigation: keep public complete closure on installer leaves used by `installation-provider-registry`, not `package-manager/index.ts` / `capabilities.ts`. Continue asserting `src/providers/first-party.ts` stays outside that closure.
- [Risk] Host-port defaults drift from CLI behavior → Mitigation: CLI binder is the production path; architecture tests plus existing package-manager unit tests cover cancellation and preference ordering.
- [Risk] Later provider/state moves copy this layout without checking remaining CLI seams → Mitigation: Core MUST NOT import `src/self` or `src/config`; a naive `src/state` move still fails those tests.

## Migration Plan

1. Land this OpenSpec change (proposal, this seam draft, spec deltas, tasks) and the ADR 0015 follow-up note.
2. Add the Core host-port leaf and CLI binder; retarget package-manager off CLI imports **before or as part of** the file move so Core never contains CLI specifiers.
3. `git mv src/package-manager` → `packages/core/src/package-manager`; rewrite escaped imports; retarget CLI/providers/state/tests/scripts.
4. Update architecture, leftover, ownership, and path-taxonomy tests.
5. Run lint, format check, typecheck, tests, OpenSpec validate, and memory check.
6. Keep the PR **draft** against `main` referencing #752. Do not auto-ready. Do not cut a release.

Rollback is git revert of the migration commits. Public SDK and CLI contracts are unchanged.

## Open Questions

None for this knife. Later knives (not this PR):

- Slice 2: `src/providers` → Core after this path is stable.
- Slice 3: `src/state` → Core after CLI config/self edges are cleaned.
