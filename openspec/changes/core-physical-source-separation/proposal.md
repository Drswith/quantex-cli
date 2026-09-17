# Proposal: core-physical-source-separation

## Why

Logical Core ownership already exists, but the physical source boundary was still a re-export: `packages/core/src` forwarded to root `src/core/**`. Completing the physical split makes CLI → Core enforceable by tests without expanding the published SDK or changing lifecycle behavior.

Product locked ownership for #741: Core owns lifecycle domain, providers, state, and receipts; CLI owns commands, presentation, exit policy, and self-upgrade UI; shared catalog and the lifecycle type-leaf are a neutral boundary. Remaining mixed modules must be called out, not guessed.

## What Changes

- Record a source-ownership table before any large file move, matching the product lock and naming physical stop points.
- Move clear Core runtime implementation from root `src/core/**` into `packages/core/src` (lifecycle domain + receipts + existing engines). Stop re-exporting root `src/core` from the Core package.
- Empty root `src/core` (no leftover runtime implementation and no re-export shim).
- Keep `src/providers` and `src/state` in root this knife: they are Core-owned logically but blocked by package-manager and CLI config/self seams.
- Keep `src/agents` as the documented neutral catalog boundary, and `packages/core/src/lifecycle/model.ts` as the documented type-leaf reverse-import boundary.
- Retarget CLI and tests onto the Core public entry (`quantex-core`) or the in-repo internal/package source bridge (`quantex-core/internal` and `packages/core/src/**`).
- Add AST/import-graph architecture tests that fail on Core → CLI shell edges and undocumented cycles, allow the type-leaf boundary, and record the provider/state stop points.
- Keep published `quantex-core` frozen at `createQuantex` plus existing supported types. Freeze `--json`, aliases, exit codes, state v2, and receipts. JSON must not expose engine or route identifiers.
- Do not merge #134 / catalog slim. Changelog is internal/architecture. No separate release unless product says otherwise.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-boundaries`: Core implementation lives under `packages/core/src`; root `src/core` is absent; CLI → Core is the allowed direction; product-locked ownership and type-leaf / catalog neutral boundaries are normative.
- `compatibility-contract`: Physical source separation MUST NOT drift frozen v1 CLI output, aliases, exit codes, state v2, receipts, or the published SDK surface.

## Impact

- `packages/core/src/**` becomes the Core implementation tree for former `src/core/**`.
- CLI production bridges, leftover-scan tests, catalog generation, and architecture tests retarget paths.
- `src/state` and `src/package-manager` keep the documented reverse import of the Core-internal lifecycle model leaf.
- Providers and state stay in root `src/` until product lifts the named stop points.
- No new CLI commands, no public SDK expansion, no YAML / `.github/workflows` / `release-core.yml` / protect-main changes, no merge of catalog slim work.

## Intake classification

Architecture-boundary and project-memory change (observable layout plus enforceable dependency direction). OpenSpec required before implementation. Requested by GitHub issue #741. Product lock applied to the ownership table after intake.
