# Proposal: relocate-core-providers

## Why

Issue #741 / ADR 0015 physically split Core into `packages/core/src` and left `src/providers` as a **deferred Core** root exception. Slice 1 (#752 / #753 / #754) sealed package-manager under Core. Slice 2 (#755) relocates providers under Core ownership so that remaining root placement is not mistaken for CLI ownership, while Core → CLI stays forbidden.

## What Changes

- Record the slice-2 ownership / seam draft: providers stays **Core-owned**; list CLI edges to cut or invert; do not reassign the module to CLI.
- Physically move `src/providers/**` to `packages/core/src/providers/**` with no leftover Core runtime under root `src/providers` and no re-export shim.
- Keep remaining deferred-Core util and catalog edges as documented root imports. Do **not** invert those into CLI-side semantics.
- Allow deferred Core modules still in root to import the relocated providers tree (same pattern as package-manager), without licensing Core runtime engines.
- Keep published `quantex-core` frozen (`createQuantex` + existing supported types). Do **not** publish providers as a public SDK method or subpath.
- Update architecture tests so they prove the new layout, forbid Core → CLI shell leaks, keep type-leaf / catalog neutrality, and record that `src/state` remains the deferred root exception.
- Note the slice on ADR 0015. Freeze `--json` / aliases / exit codes / state v2 / receipts. No new CLI commands.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-boundaries`: providers lives under `packages/core/src/providers`; Core MUST NOT import CLI shell; deferred Core modules still in root MAY import the relocated providers tree as well as package-manager; state remains a deferred root exception; catalog and the type-leaf stay the documented neutral boundary.
- `compatibility-contract`: relocating providers MUST NOT drift frozen v1 CLI output, aliases, exit codes, state v2, receipts, or the published SDK surface, and MUST NOT publish providers.

## Impact

- `packages/core/src/providers/**` becomes the Core-owned provider adapter / registry / invoke tree.
- CLI, Core engines, package-manager, agent-update, utils, tests, and build scripts retarget imports onto that path.
- `src/state` stays in root this knife.
- No YAML / workflow / `release-core.yml` / protect-main edits. No separate release (Latest stays the v1.13.6 line until product says otherwise).

## Intake classification

Architecture-boundary change (observable source layout plus enforceable dependency direction). OpenSpec required before implementation. Requested by GitHub issue #755. Follows #752 / #753 / #754 and ADR 0015.
