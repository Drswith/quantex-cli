## Context

`isManagedPackageAbsent()` uses optional `probePackagePresence` when available; npm was hardened in 0.25.5 but bun, mise, and uv still fall back to `getInstalledVersion === undefined`, which conflates confirmed absence with probe failure.

## Goals / Non-Goals

**Goals**

- Confirm bun, mise, and uv package absence only when a scoped or parseable probe shows the package is missing.
- Fail closed on inconclusive probes during ghost recovery.
- Keep version probing behavior stable for callers that only need a version string.

**Non-Goals**

- Rework Windows deferred binary self-upgrade semantics.
- Add doctor-only repair flows.
- Change bun update trust rollback semantics.

## Decisions

- Add `probePackagePresence` helpers for bun, mise, and uv returning `present`, `absent`, or `unknown`.
- Parse probe stdout regardless of exit code when output is parseable, mirroring the npm hardening.
- Wire the new hooks into managed installers and reuse shared parsing helpers where possible.
- Refactor `getInstalledVersion` to delegate to the presence reader when practical.

## Risks / Trade-offs

- [Risk] Installer list commands still return inconclusive output on broken installs. → Mitigation: return `unknown` and skip ghost recovery.
- [Risk] Extra probe hooks add interface surface. → Mitigation: optional hook used only for absence confirmation.
