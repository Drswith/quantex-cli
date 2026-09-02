## Context

ADR 0007 staged Core behind a compatibility shell: public `quantex-core` grows only after verified slices, while the CLI may consume in-repo Core modules earlier. By 1.11, Core already owns read observation plus gated `install` / `ensure`, and the CLI default-routes those two commands through `createCoreInstallationCompatibilityExecutor`. `update` and `uninstall` still execute as thick CLI modules over `services/lifecycle-updates*` and command-local uninstall logic. The published SDK still exposes only `createQuantex` with `list` / `inspect` / `install` / `ensure`.

This 1.12 first slice is explicitly CLI-only: same package names, same binaries, same frozen command catalog. Product clarification forbids expanding the published SDK or changing Core's independent publish workflow. Engine work for `update` / `uninstall` therefore lands as in-repo Core modules the CLI calls, mirroring the existing installation-compatibility bridge pattern.

## Goals / Non-Goals

**Goals:**

- Thin CLI facades for `install`, `ensure`, `update`, `uninstall`, and `list` over in-repo Core engines.
- Move update and uninstall lifecycle mutation ownership into `src/core/` modules that the CLI invokes.
- Keep Core as the pre-invocation default for those CLI mutations, with whole-invocation legacy escape and no post-side-effect fallback.
- Preserve v1 command syntax, JSON/NDJSON fields, exit meanings, PATH-only external-agent behavior, and state schema version 2.
- Keep the published `quantex-core` export surface unchanged for this slice.

**Non-Goals:**

- Adding `update` / `uninstall` / `run` to `createQuantex()`.
- Independently publishing a new Core package version as part of this change.
- Changing `release-core.yml` or Core publish cadence.
- Rewriting `exec` / `run`, `info`, `inspect`, `resolve`, `upgrade`, `config`, `doctor`, `capabilities`, `commands`, or `schema`.
- Adding commands or aliases.
- State schema version bump or 2.x package identity.

## Decisions

### 1. In-repo Core engines, not published SDK methods

Update and uninstall become Core-owned modules under `src/core/` (executor + production ports + compatibility bridge), the same layering used by installation. They are deliberately absent from `src/core/index.ts` and `packages/core` exports. The architecture purity tests continue to assert the public package exports only `createQuantex` and the existing type surface.

**Alternatives considered:** Expanding `Quantex.update` / `Quantex.uninstall` now — rejected by product freeze for this slice. Keeping engines in `src/commands/` — rejected because new lifecycle behavior must not thicken the CLI wrapper.

### 2. Reuse the installation routing model for update/uninstall

Extend the whole-invocation route selector so `install` / `ensure` / `update` / `uninstall` share Core-default + `QUANTEX_INSTALLATION_ENGINE=legacy` escape. For `install` / `ensure`, retain the existing v1 `--dry-run` → legacy planning precedence. For `update` / `uninstall`, Core owns dry-run planning inside the engine (current behavior), because those paths already implement dry-run without a separate legacy planner. `run` / `exec` stay off Core for this slice.

**Alternatives considered:** Separate env vars per command family — rejected as operator noise. Forcing update/uninstall dry-run onto the install legacy planner — rejected because it would change observed dry-run semantics.

### 3. list stays on the existing Core read path

`list` already observes through Core read ports via `observeCliReadRegisteredAgents` and projects v1 inspection rows. Do not call public `createQuantex().list()` and re-wrap descriptors into a second CLI-shaped list; the SDK list surface is intentionally narrower than the CLI table.

### 4. Preserve legacy escape code paths without rewriting remaining commands

Legacy implementations remain reachable for the expanded promoted set through the exact `legacy` override (and install/ensure dry-run). They are compatibility routes, not the default product path. Remaining frozen commands keep their current modules untouched.

### 5. Move update logic by ownership, not by greenfield rewrite

The ports-based update engine in `services/lifecycle-updates.ts` already matches Core's observe → plan → execute → verify → record shape. Relocate it under `src/core/` and rewire production/compatibility adapters so Core does not import CLI context, presenters, or forbidden service modules. Uninstall's command-local engine is extracted into the same Core layer with a thin CLI projector.

**Alternatives considered:** Full rewrite mirroring `installation-executor` recipe catalog before any facade work — deferred; higher risk to frozen JSON/exit contracts for a first slice.

## Risks / Trade-offs

- [Risk] Moving update/uninstall changes import boundaries and could accidentally pull CLI modules into Core → Mitigation: keep `test/architecture/core-boundary.test.ts` green; inject CLI-only concerns through the compatibility bridge.
- [Risk] Behavior drift in structured update/uninstall output → Mitigation: existing `test/commands/{update,uninstall}.test.ts` and `--json` contract suites are the regression gate; no intentional payload changes.
- [Risk] Readers confuse CLI Core ownership with public SDK expansion → Mitigation: OpenSpec + README explicitly state SDK methods remain unchanged and `release-core.yml` is untouched.
- [Trade-off] Legacy escape remains for the expanded set, so deletion of legacy code waits for a later approved soak/deprecation change.

## Migration Plan

1. Land OpenSpec deltas and in-repo Core update/uninstall modules.
2. Point CLI facades at Core-default routes; keep legacy escape.
3. Validate with lint/format/typecheck plus targeted command/Core/contract tests.
4. Ship as 1.12 minor via normal release-please after merge; no Core npm publish required for acceptance.
5. Rollback: operators can set `QUANTEX_INSTALLATION_ENGINE=legacy` for whole invocations of the promoted commands; package/binary/state identities are unchanged.

## Open Questions

- None for this slice. Whether a later minor publishes SDK `update` / `uninstall` remains a separate approved change after CLI soak evidence.
