# Proposal: relocate-core-package-manager

## Why

Issue #741 / ADR 0015 / OpenSpec `core-physical-source-separation` (#750 + archive #751) physically moved former `src/core/**` into `packages/core/src` and left `src/package-manager` as a **deferred Core** root exception. That exception still has named CLI seams (`cli-context`, `config`, `cli-operation-context`, `cli-child-process`). Slice 1 of #752 relocates package-manager under Core ownership and inverts those seams so Core → CLI stays forbidden.

## What Changes

- Record the slice-1 ownership / seam draft: package-manager stays **Core-owned**; list CLI edges to cut or invert; do not reassign the module to CLI.
- Physically move `src/package-manager/**` to `packages/core/src/package-manager/**` with no leftover Core runtime under root `src/package-manager` and no re-export shim.
- Invert CLI coupling through a Core-owned host-port leaf; CLI binds that port from the shell (`cli-context` / CLI operation context / config / `cli-child-process`).
- Keep published `quantex-core` frozen (`createQuantex` + existing supported types). Do **not** publish package-manager as a public SDK method or subpath.
- Update architecture tests so they prove the new layout, forbid Core → CLI shell leaks, allow deferred Core modules still in root to import the relocated package-manager tree, and keep the type-leaf / catalog neutral rules.
- Note the slice on ADR 0015. Freeze `--json` / aliases / exit codes / state v2 / receipts. No new CLI commands.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-boundaries`: package-manager lives under `packages/core/src/package-manager`; CLI seams are inverted; Core MUST NOT import CLI shell; deferred Core modules still in root MAY import the relocated package-manager tree; providers and state remain deferred root exceptions; catalog and the type-leaf stay the documented neutral boundary.
- `compatibility-contract`: relocating package-manager MUST NOT drift frozen v1 CLI output, aliases, exit codes, state v2, receipts, or the published SDK surface, and MUST NOT publish package-manager.

## Impact

- `packages/core/src/package-manager/**` becomes the Core-owned installer / agent-lifecycle orchestration tree.
- CLI, providers, state, agent-update, utils, tests, and smokes retarget imports onto that path.
- A CLI-owned binder supplies cancellation, config preferences, operation context, and binary-shell spawn without Core importing CLI modules.
- `src/providers` and `src/state` stay in root this knife.
- No YAML / workflow / `release-core.yml` / protect-main edits. No separate release (Latest stays the v1.13.6 line until product says otherwise).

## Intake classification

Architecture-boundary change (observable source layout plus enforceable dependency direction). OpenSpec required before implementation. Requested by GitHub issue #752. Follows #741 / ADR 0015 / archived `core-physical-source-separation`.
