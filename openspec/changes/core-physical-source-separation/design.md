# Design: core-physical-source-separation

## Context

At the 1.13.6 line, `packages/core` is a workspace and distribution package. This knife physically moves Core runtime from root `src/core/**` into `packages/core/src` and stops package re-exports of `../../../src/core`.

Product locked ownership for #741:

- Core owns the lifecycle domain, provider adapters, persisted state, and receipts.
- CLI owns commands, presentation, exit policy, and self-upgrade UI.
- Shared catalog and the lifecycle type-leaf are a **neutral boundary**.
- If a remaining module is still mixed, stop and call out the ambiguity instead of guessing a wide move.

Investigation after that lock: receipt types and lifecycle engines already live under `packages/core/src/lifecycle/`. `src/state` still value-imports CLI `src/config` and `src/self/types`. `src/providers` adapters value-import `src/package-manager/*`, whose `index.ts` is still CLI-coupled. Package-manager, runtime ports, and agent-update were not assigned by the product lock.

## Goals / Non-Goals

**Goals:**

- Record the product-locked ownership table, including physical stop points.
- `packages/core/src` owns Core runtime implementation that is already clear to move (former `src/core/**`, including lifecycle domain and receipts). Package entries no longer re-export root `src/core`.
- Root `src/core` contains no Core runtime implementation.
- CLI depends on Core through the public SDK entry and the in-repo internal/package source bridge.
- Architecture tests prove CLI → Core, reject Core → CLI shell, reject undocumented cycles, allow the documented type-leaf reverse-import boundary, and record why providers/state stay in root this knife.
- Preserve lazy mutation loading, Core package constraints, CLI compatibility output, and no-engine/no-route public payloads.

**Non-Goals:**

- Expanding the published `quantex-core` export surface or adding CLI commands.
- Changing agent lifecycle behavior, `--json` schema, aliases, exit codes, state v2, or receipt JSON.
- Physically relocating `src/providers` or `src/state` in this knife (Core-owned, blocked by named seams).
- Guessing ownership or relocation of package-manager, runtime ports, or agent-update.
- Splitting `src/package-manager/index.ts` off `cli-context` / `config` without a product decision.
- Merging catalog slim / #134, YAML / `.github/workflows` / `release-core.yml` edits, or cutting a release.
- Restoring `src/lifecycle/` or adding a Core lifecycle barrel.

## Ownership table

Product lock (logical owner) is the first column. Physical location this knife is separate: only clear, unblocked Core-owned code moves.

| Area | Logical owner | This knife | Notes |
|---|---|---|---|
| `packages/core/src/**` except providers/state (former `src/core/**`) | Core | Moved | Lifecycle domain, receipts, mutation/execution/doctor/self-upgrade engines. Public entry remains `createQuantex` + supported types. |
| `packages/core/src/lifecycle/model.ts` | Core (receipt / type leaf) | Moved with Core | Zero-import leaf. **Neutral reverse-import boundary:** `src/state` and `src/package-manager/index.ts` MAY import it. MUST NOT import Core runtime. |
| Other `packages/core/src/lifecycle/*` | Core (lifecycle domain) | Moved with Core | No barrel. CLI/services/idempotency MAY import directly. `src/state` MUST NOT. |
| `src/providers/**` | Core | Stay in root (blocked) | Product-owned by Core. Physical move stopped: adapters import `src/package-manager/*`, and package-manager ownership is not locked. Eager public Core closure still MUST NOT load `first-party.ts`. |
| `src/state/**` | Core | Stay in root (blocked) | Product-owned by Core. Physical move stopped: `index.ts` imports CLI `src/config` (`getConfigDir`) and `src/self/types` (`SelfInstallSource`); `schema.ts` also imports `SelfInstallSource`. Reverse edge onto the type leaf only. |
| `src/commands/**`, `src/cli.ts`, `src/cli-context.ts`, `src/command-runtime.ts`, `src/command-contract/**`, `src/output/**` | CLI (commands / presentation / exit policy) | Stay | Core MUST NOT import. |
| `src/self/**` | CLI (self-upgrade UI) | Stay | Core self-upgrade executor consumes injected ports only. State currently type-imports `SelfInstallSource` from here — that seam blocks moving state. |
| `src/services/**`, `src/compatibility/**`, `src/idempotency/**`, `src/planning/**`, `src/inspection/**`, `src/config/**` | CLI | Stay | Bridges/projectors over Core. `src/config` is also the state `getConfigDir` blocker. |
| `src/runtime/cli-operation-context.ts` | CLI | Stay | Core MUST NOT import this file or value-import the `src/runtime` barrel that re-exports it. |
| `src/utils/user-output.ts`, `src/utils/color.ts`, `src/utils/cli-child-process.ts` | CLI presentation | Stay | Core MUST NOT import. |
| `src/agents/**` | Neutral shared catalog | Stay | Documented **neutral boundary**. Used by CLI compatibility and Core. Not Core-owned and not CLI-owned. |
| `src/package-manager/**` | Unlocked / mixed | Stay | **Not guessed.** `index.ts` imports CLI `cli-context`, `config`, and `cli-operation-context`. Leaf installers are used by Core-owned providers. |
| `src/runtime/**` except CLI operation context | Unlocked | Stay | **Not guessed.** Process/cache/network/lock ports. |
| `src/agent-update/**` | Unlocked | Stay | **Not guessed.** Used by Core update production and CLI projectors. |
| Remaining `src/utils/**` | Unlocked helpers | Stay | **Not guessed.** Presentation utils stay CLI-owned. |

### Physical stop points (called out, not guessed)

1. **`src/state` cannot move into `packages/core` yet.** It imports CLI-owned `src/config` and `src/self/types`. Product must decide whether `SelfInstallSource` becomes Core state schema, and whether config-dir resolution is injected as a port, before a state relocation knife.

2. **`src/providers` cannot move into `packages/core` yet.** Adapters import `src/package-manager/{npm,brew,...}` and `context-mutation`. Product must decide whether those installer leaves move with providers, stay as a port, or split from the CLI-coupled `package-manager/index.ts`. Guessing either way would drag mixed orchestration into Core or leave an undocumented Core package → root installer edge as if the split were finished.

3. **`src/package-manager`, `src/runtime` (except CLI operation context), and `src/agent-update` stay unlocked.** The product lock did not assign them. Architecture tests keep the existing deferred `package-manager/index` CLI-coupling allowlist.

## Decisions

1. **Minimal first knife: move only former `src/core/**`.** Receipts and the lifecycle domain are already in that tree and are clear Core-owned code. Providers and state are Core-owned logically but physically blocked; they stay in root with named stop points. Alternative: big-bang move of providers/state/package-manager. Rejected: that guesses unlocked seams and would import CLI config/self into the Core package.

2. **No root `src/core` shim.** After the move, CLI and tests import `packages/core/src/**` (or `quantex-core` / `quantex-core/internal`). A re-export shim would preserve the incomplete physical boundary this knife exists to remove.

3. **Keep published exports frozen.** `packages/core/package.json` still exports only `.` and `./package.json`. `quantex-core/internal` remains an in-repo alias, not a published subpath. CLI-facing engines stay unpublished. Do not publish providers, state, or receipts.

4. **Preserve intra-Core relative imports.** Only imports that previously escaped `src/core` into root `src/<shared>` are rewritten to `../../../src/<shared>` (depth-adjusted). Generated catalog import paths update the same way.

5. **Architecture tests become the enforcement.** Direct Core specifiers MUST NOT match CLI-owned paths. Reverse imports into Core from `src/` MUST land only on the documented model leaf, except CLI-owned modules which MAY import any Core-internal module. Cycles through Core runtime (not the leaf) are forbidden. Transitive Core → `package-manager/index` → `cli-context` is an allowlisted deferred exception. Tests MUST also record that `src/providers` and `src/state` remain outside `packages/core/src` until the stop points are lifted.

6. **Type-only runtime barrel imports are retargeted.** Core type-imports `src/runtime/ports` (and invocation-context if needed) so the specifier graph does not name the CLI operation-context module.

7. **Core does not read CLI config.** `loadProductionCoreUpdatePorts` defaults `npmBunUpdateStrategy` to `latest-major` (the frozen config default). CLI production already injects the user-config value. This removes a direct Core → `src/config` edge without changing CLI update behavior.

8. **Changelog framing is internal architecture.** Commit as `chore(core):` / `docs(openspec):` so release-please does not invent a user-facing feature. No separate release unless product says otherwise. Behavior and schema stay frozen.

## Risks / Trade-offs

- [Risk] Calling providers/state Core-owned while they still live under root `src/` looks unfinished → Mitigation: OpenSpec/ADR name the physical stop points; architecture tests assert they have not been moved and still carry the blocking imports.
- [Risk] A later contributor moves providers/state without splitting the CLI seams → Mitigation: Core MUST NOT import `src/self` or `src/config`; a naive move would fail those tests.
- [Risk] Shared-module relative imports (`../../../src/agents`) look like Core still lives in the CLI tree → Mitigation: catalog is the documented neutral boundary; other root imports are allowlisted unlocked or blocked Core-owned modules.
- [Risk] Eager/lazy mutation closure drifts → Mitigation: keep the existing runtime-closure architecture assertions, including `first-party.ts` exclusion.
- [Risk] Transitive package-manager CLI coupling is mistaken for a completed split → Mitigation: name it as a deferred exception in tests, design, and PR body.

## Migration Plan

1. Land the product-locked ownership table in this OpenSpec change and ADR 0015 before expanding the move.
2. `git mv` former `src/core` implementation into `packages/core/src`, replace package re-exports with local entries, rewrite escaped imports, retarget CLI/tests/scripts.
3. Update architecture, leftover, and ownership tests, including product-lock stop points.
4. Run lint, format check, typecheck, tests, OpenSpec validate, and memory check.
5. Keep the PR **draft** against `main` referencing #741. Do not auto-ready. Do not cut a release.

Rollback is git revert of the migration commit. Public SDK and CLI contracts are unchanged, so callers of published artifacts are unaffected.

## Open Questions

Product decisions required before a later knife (not guessed here):

- Whether `SelfInstallSource` leaves `src/self/types` and becomes Core state schema, and whether state config-dir resolution is injected as a port, so `src/state` can relocate into `packages/core`.
- Whether `src/package-manager` installer leaves move with Core-owned providers, stay as a port, or split from the CLI-coupled `index.ts`.
- Whether runtime ports and `src/agent-update` are Core, CLI, or a lasting port layer.
