## Context

`isManagedPackageAbsent()` uses optional `probePackagePresence` when available. npm, bun, mise, and uv were hardened in 0.25.5–0.25.9, but brew still has no presence hook, so ghost recovery never runs for Homebrew-managed installs.

## Goals / Non-Goals

**Goals**

- Confirm brew formula or cask absence only when `brew list` shows the package is missing.
- Fail closed on inconclusive probes during ghost recovery.
- Preserve existing brew install, update, and uninstall command behavior.

**Non-Goals**

- Add ghost recovery for cargo, pip, winget, or deno in this change.
- Rework config.json durability or Windows deferred self-upgrade locking.

## Decisions

- Add `probePackagePresence` and `getInstalledVersion` helpers to `brew.ts` using `brew list --formula|--cask --versions`.
- Treat exit code 1 with a "No such keg" style message as confirmed absence; other failures return `unknown`.
- Wire the new hooks into the brew managed installer entry.

## Risks / Trade-offs

- [Risk] Brew list output format varies for tap formulas. → Mitigation: parse the trailing version token and treat unparseable success output as `unknown`.
- [Risk] Extra probe subprocess on failed uninstall. → Mitigation: only run after uninstall failure, matching existing npm/bun behavior.
