## Context

After the 1.12 first slice, CLI mutation commands and `list` already execute through in-repo Core. `inspect`, `info`, and `resolve` already observe via `resolveCliReadObservation` → `quantex-core/internal` Core read ports, then project richer v1 CLI payloads through `projectObservationToV1Inspection`. The published SDK `inspect()` / `list()` return narrower typed descriptors than the CLI `--json` contracts, so wrapping the public SDK would either drop fields or invent a second CLI-shaped API on top of Core.

This second slice contracts and cleans that already-correct path: thin facades, frozen CLI contracts, unchanged published SDK, untouched `release-core.yml`.

## Goals / Non-Goals

**Goals:**

- Lock CLI `inspect` / `info` / `resolve` as thin projectors over in-repo Core read observation (alongside `list`).
- Keep command modules presentation-focused; extract shared CLI projection helpers only when they reduce duplicated facade glue.
- Preserve frozen v1 `--json` / `--output`, exit codes, command names/aliases, package/binary identity, and state schema version 2.
- Keep the published `quantex-core` export surface unchanged.

**Non-Goals:**

- Expanding `createQuantex().inspect` / `list` or adding new SDK methods.
- Changing `release-core.yml` or Core's independent publish cadence.
- Rewriting `doctor`, `capabilities`, `commands`, `schema`, `exec` / shortcut-run, upgrade / self-upgrade, or config.
- Adding commands or aliases.
- State schema migration or 2.x identity.

## Decisions

### 1. Stay on Core read ports; do not wrap public SDK `inspect()`

Continue observing through `resolveCliReadObservation` / Core read ports. Project with the existing v1 inspection compatibility helper into the richer CLI command payloads. Do not call `createQuantex().inspect()` and re-wrap SDK `AgentInspection` unions into CLI JSON—the SDK type is intentionally narrower and shaped for library consumers.

**Alternatives considered:** Route CLI inspect through the public SDK client — rejected because CLI contracts include install-method tables, capability booleans, resolve guidance, and supersession warnings that are not the SDK surface.

### 2. Thin by ownership, not by deleting presentation

Command modules may retain human renderers and frozen JSON assembly. “Thin” means they must not own observation engines, PATH probing, or state reads outside the Core-backed adapter. Shared projection helpers are allowed when they keep each command a facade.

### 3. Product narrative updates without implying SDK growth

README wording for 1.12 adds Core-backed CLI `inspect` / `info` / `resolve` next to `list`, while restating that the published SDK methods remain the previously published set and that Core publish stays independent.

## Risks / Trade-offs

- [Risk] Refactoring projection helpers could drift frozen JSON fields → Mitigation: existing command and v1 baseline tests are the gate; no intentional payload changes.
- [Risk] Readers confuse CLI Core ownership with public SDK expansion → Mitigation: OpenSpec + README explicitly freeze the SDK surface and leave `release-core.yml` untouched.
- [Trade-off] `doctor` already uses Core read observation but stays out of scope for this slice's contract wording to avoid scope creep.

## Migration Plan

1. Land OpenSpec deltas for the read-observation slice.
2. Extract or clarify thin CLI facades; strengthen import-boundary tests.
3. Update product README Core transition wording.
4. Validate with lint/format/typecheck plus focused command/read/contract tests.
5. Ship as part of 1.12 minor via release-please after merge; no Core npm publish required.

## Open Questions

- None for this slice.
