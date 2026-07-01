## Context

`isManagedPackageAbsent()` delegates to installer `getInstalledVersion` hooks. npm's implementation runs `npm list -g --depth=0 --json` and returns `undefined` whenever the command exits non-zero, even when stdout contains valid JSON showing the target package is still installed.

## Goals / Non-Goals

**Goals**

- Confirm npm package absence only when a scoped probe parses valid JSON and the package is missing.
- Fail closed on inconclusive npm probes during ghost recovery.
- Keep version probing behavior stable for callers that only need a version string.

**Non-Goals**

- Rework Windows deferred binary self-upgrade semantics.
- Add doctor-only repair flows.
- Change bun or other installer ghost recovery beyond existing behavior.

## Decisions

- Add an npm `probePackagePresence` helper returning `present`, `absent`, or `unknown`.
- Use scoped `npm list -g <package> --depth=0 --json` and parse stdout regardless of exit code when JSON is valid.
- Treat a matching dependency key as present even when its version is unreadable, and treat structured npm error payloads as unknown.
- Extend the managed installer interface with optional `probePackagePresence` and use it in `isManagedPackageAbsent()` when available.
- Fall back to the existing `getInstalledVersion === undefined` check for installers without the new hook.

## Risks / Trade-offs

- [Risk] Scoped npm list still returns inconclusive output on some broken npm installs. → Mitigation: return `unknown` and skip ghost recovery.
- [Risk] Extra probe hook adds interface surface. → Mitigation: optional hook used only for absence confirmation.
