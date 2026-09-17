# Proposal: core-physical-source-separation

## Why

Logical Core ownership already exists, but the physical source boundary is still a re-export: `packages/core/src` forwards to root `src/core/**`, CLI modules import those internals directly, and Core still shares a directory tree with CLI shell code. Completing the physical split makes CLI → Core enforceable by tests without expanding the published SDK or changing lifecycle behavior.

## What Changes

- Record a source-ownership table before any large file move: Core-owned, CLI-owned, and documented neutral/shared exceptions.
- Move Core runtime implementation from root `src/core/**` into `packages/core/src`. Stop re-exporting root `src/core` from the Core package.
- Empty root `src/core` (no leftover runtime implementation and no re-export shim).
- Retarget CLI, state, package-manager, and tests onto the Core public entry (`quantex-core`) or the in-repo internal/package source bridge (`quantex-core/internal` and `packages/core/src/**`).
- Add AST/import-graph architecture tests that fail on Core → CLI shell edges and undocumented cycles, while allowing documented type-leaf reverse edges.
- Keep published `quantex-core` frozen at `createQuantex` plus existing supported types. Freeze `--json`, aliases, exit codes, state v2, and receipts. JSON must not expose engine or route identifiers.
- Document deferred shared-module moves (agents, providers, state, package-manager, runtime ports, agent-update) instead of guessing a wide relocation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-boundaries`: Core implementation lives under `packages/core/src`; root `src/core` is absent; CLI → Core is the allowed direction; ownership table and type-leaf exceptions are normative.
- `compatibility-contract`: Physical source separation MUST NOT drift frozen v1 CLI output, aliases, exit codes, state v2, receipts, or the published SDK surface.

## Impact

- `packages/core/src/**` becomes the Core implementation tree (replacing `src/core/**`).
- CLI production bridges, leftover-scan tests, catalog generation, and architecture tests retarget paths.
- `src/state` and `src/package-manager` keep the documented reverse import of the Core-internal lifecycle model leaf at its new path.
- Shared modules stay in root `src/` for this knife.
- No new CLI commands, no public SDK expansion, no YAML / `.github/workflows` / `release-core.yml` / protect-main changes, no merge of catalog slim work.

## Intake classification

Architecture-boundary and project-memory change (observable layout plus enforceable dependency direction). OpenSpec required before implementation. Requested by GitHub issue #741.
