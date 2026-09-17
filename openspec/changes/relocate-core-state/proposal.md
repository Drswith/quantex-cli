# Proposal: relocate-core-state

## Why

Issue #741 / ADR 0015 physically split Core into `packages/core/src` and left `src/state` as a **deferred Core** root exception. Slice 1 (#752 / #753 / #754) sealed package-manager. Slice 2 (#755 / #756 / #757) sealed providers. Slice 3 (#759) relocates persisted state under Core ownership so remaining root placement is not mistaken for CLI ownership, while Core → CLI stays forbidden.

## Product scope lock

This knife is **only** deferred Core relocation slice 3. Default owner does not change.

- Relocate **only** `src/state/**` → `packages/core/src/state/**`. Keep `src/state.ts` as the published v1 barrel. Do not relocate config, capabilities, commands, schema, catalog, runtime, or agent-update.
- Catalog (`src/agents`) and the lifecycle type-leaf (`packages/core/src/lifecycle/model.ts`) remain the documented **neutral boundary**. Do not label them CLI-owned. Do not start #134 or catalog slim-down.
- When cutting CLI seams, **invert or inject** host ports. Do **not** rewrite remaining lock/catalog edges into CLI-side semantics. Freeze `loadState`, lock path, state v2, receipts, `--json` / aliases / exit codes.
- Public `quantex-core` stays frozen (`createQuantex` + existing supported types). Do not publish state. Changelog framing is internal architecture (`chore` / `docs`). No separate release (Latest stays the v1.13.6 line).
- Do not fold `src/config`. Do not add YAML / workflow / `release-core.yml` / protect-main edits. Keep the delivery PR **draft** until green; do not auto-ready.

Knife order remains: ownership / seam draft → OpenSpec → migrate → architecture tests.

## What Changes

- Record the slice-3 ownership / seam draft: state stays **Core-owned**; list CLI edges to cut or invert; do not reassign the module to CLI.
- Physically move `src/state/**` to `packages/core/src/state/**` with no leftover Core runtime under root `src/state/` and no directory re-export shim. Keep published v1 convenience barrel `src/state.ts`.
- Invert CLI `src/config` (`getConfigDir`) through Core-owned host ports bound by CLI. Own persisted `SelfInstallSource` in the state schema and have CLI `src/self/types` re-export it. Do **not** rewrite remaining deferred-Core lock/catalog edges into CLI-side semantics.
- Keep published `quantex-core` frozen (`createQuantex` + existing supported types). Do **not** publish state as a public SDK method or subpath.
- Update architecture tests so they prove the new layout, forbid Core → CLI shell leaks, allow deferred Core modules still in root to import the relocated state tree, and keep type-leaf / catalog neutrality.
- Note the slice on ADR 0015. Freeze `--json` / aliases / exit codes / state v2 / receipts. No new CLI commands.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-boundaries`: state lives under `packages/core/src/state`; this knife relocates only that tree; Core MUST NOT import CLI shell; CLI MAY bind Core-owned state host ports; catalog and the type-leaf stay the documented neutral boundary; config stays unfolder; #134 / catalog slim-down stay out of scope.
- `compatibility-contract`: relocating state MUST NOT drift frozen v1 CLI output, aliases, exit codes, state v2, receipts, or the published SDK surface, and MUST NOT publish state.

## Impact

- `packages/core/src/state/**` becomes the Core-owned persisted-state / receipt-store tree.
- CLI, Core engines, package-manager, lifecycle helpers, tests, and smoke scripts retarget imports onto that path (CLI may keep using `src/state.ts`).
- `src/config`, capabilities, commands, and schema stay unfolder. Catalog and the type-leaf stay the documented neutral boundary.
- No YAML / workflow / `release-core.yml` / protect-main edits. No separate release (Latest stays the v1.13.6 line until product says otherwise).

## Intake classification

Architecture-boundary change (observable source layout plus enforceable dependency direction). OpenSpec required before implementation. Requested by GitHub issue #759. Follows #755 / #756 / #757 and ADR 0015.
