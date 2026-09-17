# Design: core-physical-source-separation

## Context

At the 1.13.6 line, `packages/core` is a workspace and distribution package, but `packages/core/src/index.ts` and `packages/core/src/internal.ts` re-export `../../../src/core/**`. Core engines, lifecycle helpers, and generated catalogs still live beside CLI shell code. CLI production code imports those internals from `src/core/**` except the read adapter, which already uses `quantex-core/internal`.

Core currently imports root modules: agents, providers, state, package-manager, runtime, utils, and agent-update. `src/state` (and `src/package-manager/index.ts`) import the Core-internal lifecycle model leaf. ADR 0011 already allows that leaf reverse edge; the directory-level graph is therefore not fully acyclic.

Issue #741 requires an ownership decision before the move. Shared modules are used by both CLI and Core. Moving them into `packages/core` in the same knife would mix catalog, persistence, provider adapters, and CLI-coupled package-manager orchestration into the SDK package without a product decision.

## Goals / Non-Goals

**Goals:**

- `packages/core/src` owns Core implementation. Package entries no longer re-export root `src/core`.
- Root `src/core` contains no Core runtime implementation.
- CLI depends on Core through the public SDK entry and the in-repo internal/package source bridge.
- Architecture tests prove CLI → Core, reject Core → CLI shell, reject undocumented cycles, and allow documented type-leaf exceptions.
- Preserve lazy mutation loading, Core package constraints, CLI compatibility output, and no-engine/no-route public payloads.

**Non-Goals:**

- Expanding the published `quantex-core` export surface or adding CLI commands.
- Changing agent lifecycle behavior, `--json` schema, aliases, exit codes, state v2, or receipt JSON.
- Moving agents, providers, state, package-manager, runtime ports, or agent-update into Core in this knife.
- Splitting `src/package-manager/index.ts` off `cli-context` / `config` (deferred; documented exception).
- Workflow-orchestration expansion, catalog slim, YAML / GitHub workflow / `release-core.yml` edits, or cutting a release.
- Restoring `src/lifecycle/` or adding a Core lifecycle barrel.

## Ownership table

| Area | Owner | This knife | Notes |
|---|---|---|---|
| `packages/core/src/**` (today `src/core/**`) | Core | Move implementation here | Public entry remains `createQuantex` + supported types. Internal engines stay unpublished. |
| `packages/core/src/lifecycle/model.ts` | Core type leaf | Move with Core | Zero-import leaf. `src/state` and `src/package-manager/index.ts` MAY import it. MUST NOT import Core runtime. |
| `packages/core/src/lifecycle/*` except `model.ts` | Core-internal | Move with Core | No barrel. CLI/services/idempotency MAY import directly. `src/state` MUST NOT. |
| `src/commands/**`, `src/cli.ts`, `src/cli-context.ts`, `src/command-runtime.ts`, `src/command-contract/**`, `src/output/**` | CLI shell / presentation | Stay | Core MUST NOT import. |
| `src/self/**` | CLI self-upgrade domain + UI policy | Stay | Core self-upgrade executor consumes injected ports only. |
| `src/services/**`, `src/compatibility/**`, `src/idempotency/**`, `src/planning/**`, `src/inspection/**`, `src/config/**` | CLI | Stay | Bridges/projectors over Core. |
| `src/runtime/cli-operation-context.ts` | CLI | Stay | Core MUST NOT import this file or value-import the `src/runtime` barrel that re-exports it. |
| `src/utils/user-output.ts`, `src/utils/color.ts`, `src/utils/cli-child-process.ts` | CLI presentation | Stay | Core MUST NOT import. |
| `src/agents/**` | Neutral shared catalog | Stay (exception) | Product catalog used by CLI compatibility and Core. Moving it is a later ownership decision. |
| `src/providers/**` | Neutral provider adapters | Stay (exception) | Core and CLI both observe/mutate through these adapters. Eager public Core closure still MUST NOT load `first-party.ts`. |
| `src/state/**` | Neutral persistence | Stay (exception) | Runtime used by Core and CLI. Reverse edge only onto the model leaf. |
| `src/package-manager/**` | Mixed / deferred | Stay (exception) | Core uses installer outcome modules. `index.ts` also imports `cli-context` and `config`. Do not guess a split in this knife. |
| `src/runtime/**` except CLI operation context | Neutral runtime ports | Stay (exception) | Process/cache/network/lock ports. |
| `src/agent-update/**` | Neutral agent-update helpers | Stay (exception) | Used by Core update production and CLI projectors. |
| Remaining `src/utils/**` | Neutral helpers | Stay (exception) | Version compare, PATH search, locks, registry, detect, child-process. Presentation utils stay CLI-owned. |

### Ambiguity (product follow-up, not guessed here)

`src/package-manager/index.ts` is the main mixed module: Core calls `withAgentLifecycleLock` / uninstall helpers from it, while that file imports CLI `cli-context` and `config`. A later knife may extract a Core-safe lock/orchestration leaf. Until then, architecture tests forbid **direct** Core → CLI edges and record this transitive coupling as a named deferred exception rather than relocating package-manager into Core.

`src/agents`, `src/providers`, and `src/state` are shared infrastructure, not CLI shell. They stay in root `src/` as explicit neutral exceptions. ADR 0007 already rejected extra packages for those seams.

## Decisions

1. **Minimal first knife: move only `src/core/**`.** That tree is already Core-owned. Shared modules stay put and are listed in the ownership table. Alternative: big-bang move of agents/providers/state/package-manager. Rejected: ownership is mixed and would drag CLI-coupled code into the Core package.

2. **No root `src/core` shim.** After the move, CLI and tests import `packages/core/src/**` (or `quantex-core` / `quantex-core/internal`). A re-export shim would preserve the incomplete physical boundary this knife exists to remove.

3. **Keep published exports frozen.** `packages/core/package.json` still exports only `.` and `./package.json`. `quantex-core/internal` remains an in-repo alias, not a published subpath. CLI-facing engines stay unpublished.

4. **Preserve intra-Core relative imports.** Only imports that previously escaped `src/core` into root `src/<shared>` are rewritten to `../../../src/<shared>` (depth-adjusted). Generated catalog import paths update the same way.

5. **Architecture tests become the enforcement.** Direct Core specifiers MUST NOT match CLI-owned paths. Reverse imports into Core from `src/` MUST land only on the documented model leaf, except CLI-owned modules which MAY import any Core-internal module. Cycles through Core runtime (not the leaf) are forbidden. Transitive Core → `package-manager/index` → `cli-context` is an allowlisted deferred exception; new undeclared Core → CLI leaks fail.

6. **Type-only runtime barrel imports are retargeted.** Core currently type-imports `../runtime`, whose barrel re-exports CLI operation context. After the move, Core type-imports `src/runtime/ports` (and invocation-context if needed) so the specifier graph does not name the CLI operation-context module.

7. **Core does not read CLI config.** `loadProductionCoreUpdatePorts` defaults `npmBunUpdateStrategy` to `latest-major` (the frozen config default). CLI production already injects the user-config value. This removes a direct Core → `src/config` edge without changing CLI update behavior.

8. **Changelog framing is internal architecture.** Commit as `chore(core):` so release-please does not invent a user-facing feature. Behavior and schema stay frozen.

## Risks / Trade-offs

- [Risk] Shared-module relative imports (`../../../src/agents`) look like Core still lives in the CLI tree → Mitigation: architecture tests name the allowlist; OpenSpec/ADR record the exception; a later knife can move a module once ownership is decided.
- [Risk] Import rewrites miss a leftover `src/core` path → Mitigation: leftover/ownership tests assert `src/core` is absent and that production importers use `packages/core/src`.
- [Risk] Eager/lazy mutation closure drifts → Mitigation: keep the existing runtime-closure architecture assertions, retargeted at `packages/core/src`.
- [Risk] State/package-manager leaf imports break after the path change → Mitigation: rewrite those two documented reverse edges in the same commit as the move.
- [Risk] Transitive package-manager CLI coupling is mistaken for a completed split → Mitigation: name it as a deferred exception in tests, design, and PR body.

## Migration Plan

1. Land ownership table in this OpenSpec change and ADR 0015. Do not move files in that commit.
2. `git mv` Core implementation into `packages/core/src`, replace package re-exports with local entries, rewrite escaped imports, retarget CLI/tests/scripts.
3. Update architecture, leftover, and ownership tests.
4. Run lint, format check, typecheck, tests, OpenSpec validate, and memory check.
5. Open a **draft** PR against `main` referencing #741. Do not auto-ready. Do not cut a release.

Rollback is git revert of the migration commit. Public SDK and CLI contracts are unchanged, so callers of published artifacts are unaffected.

## Open Questions

None for this knife. Follow-up product decisions (not in this PR):

- Whether `src/package-manager/index.ts` should split into a Core-safe lock/orchestration leaf.
- Whether agents, providers, or state later move into `packages/core` or stay permanently neutral in root `src/`.
