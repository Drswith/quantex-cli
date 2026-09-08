# Design: inspect-provider-version-fallback

## Context

`observeAgentLifecycle` already computes a merged executable via `mergeExecutableObservation`: `version: executable.version ?? providerObservation.version`. That merged value is `CoreAgentObservation.executable`. The v1 projector `projectObservationToV1Inspection` currently copies `result.pathExecutable` for `inPath`, `installedVersion`, and `binaryPath`. `pathExecutable` is the raw `where` + `--version` probe, so a crashing probe yields `present: true` with no version, and the CLI prints `unknown`.

Live evidence from the original report: `pathExecutable` had a PATH hit and no version, while `executable` already carried `0.85.1` from the bun provider (`bun pm -g ls`).

## Goals / Non-Goals

**Goals:**

- `list`, `inspect`, and `doctor` (and other CLI reads that share the same projector: `info`, `resolve`) show the provider version when PATH is present and the version probe failed.
- PATH-absent agents stay `installed: false` even if the provider reports a version.
- Failed probe stdout/stderr still cannot become version evidence.

**Non-Goals:**

- New commands, flags, aliases, exit codes, state schema, receipt fields, or SDK exports.
- Changing `--json` shape or exposing engine/route.
- Changing merge/observation internals, install decide, update planning, or canary probe parsing.
- Issues #133/#134, Release Please #736, or a release tag.

## Decisions

1. **Fix the projector, not the probe.** Observation already merges provider version onto `executable`. Display should read that field for `installedVersion` when `pathExecutable.present` is true. Alternatives considered: parsing failed-probe stderr (forbidden by the existing probe-stream rule), or reading receipt version directly in the projector (duplicates merge and bypasses live provider evidence).

2. **Keep `inPath` / `binaryPath` on `pathExecutable`.** v1 `installed` means PATH presence. A tracked provider-present PATH-absent conflict must stay absent in v1. Using merged `executable.present` for `inPath` would report those agents as installed.

3. **Do not change JSON field names.** `installedVersion` keeps its meaning; this fills a previously empty optional value from a source the observation layer already computed.

## Risks / Trade-offs

- [Risk] PATH-absent + provider version accidentally displays as installed → Mitigation: `installedVersion` is gated on `pathExecutable.present`; existing PATH-absent projector test stays.
- [Risk] Failed-probe stderr is treated as a version → Mitigation: probe layer is unchanged; only the already-merged provider field is displayed.

## Migration Plan

1. Land the projector change and regressions together.
2. Do not tag a release in this PR; release-please consumes the user-facing `fix:` override after merge.

## Open Questions

None.
