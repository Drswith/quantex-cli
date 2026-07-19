## Context

Lifecycle redesign made provider observation mandatory for install verification and uninstall planning. npm, bun, mise, and uv already expose presence probes. Homebrew still hardcodes `probePackagePresence` to `unknown` in the brew provider adapter, so brew observation always returns `indeterminate`.

## Goals / Non-Goals

**Goals**

- Confirm brew formula or cask presence/absence through `brew list --formula|--cask --versions`.
- Fail closed on inconclusive brew probes during observation, install verification, and ghost recovery.
- Preserve existing brew install, update, and uninstall command behavior.
- Expose the same probes through managed-installer compatibility projections used by legacy package-manager callers.

**Non-Goals**

- Add presence probing for cargo, pip, winget, or deno in this change.
- Change uninstall planning policy beyond making brew observation conclusive when Homebrew can answer.
- Rework self-upgrade or release artifact flows.

## Decisions

- Add `probePackagePresence` and `getInstalledVersion` helpers to `src/package-manager/brew.ts`, mirroring mise/npm patterns and using contextual process IO when a provider context is present.
- Treat exit code 1 with a "No such keg" / "is not installed" style stderr as confirmed absence; other non-zero exits and parse failures return `unknown`.
- Wire the helpers into `src/providers/adapters/brew.ts` and the brew entry in `src/package-manager/installers.ts`.
- Keep formula vs cask distinction via `--formula` / `--cask` list flags so tap formulas and casks do not cross-probe.

## Risks / Trade-offs

- [Risk] Brew list output format varies for tap formulas. → Mitigation: parse the trailing version token and treat unparseable success output as `present` without version rather than `unknown` only when exit code is 0.
- [Risk] Extra probe subprocess on observe/verify paths. → Mitigation: same cost model as mise/npm; required for redesign observation contracts.
- [Risk] Older open PR #440 targeted pre-redesign package-manager wiring only. → Mitigation: re-implement against current provider adapter + installer compatibility surfaces on main.

## Migration Plan

- Ship as a narrow behavior fix PR.
- Archive the OpenSpec change after merge and accepted delta sync.
