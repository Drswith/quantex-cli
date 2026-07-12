## Context

Untracked single-agent updates intentionally remain allowed when `update --all` skips PATH-only detections. Managed installer selection currently scans ordered install methods and prefers `defaultPackageManager` (Bun). That scan describes candidate install options, not the source that owns the current binary. Separately, Bun `update -g` installs missing packages, and npm latest-major update uses `npm install -g`, so an absent-package update can create or claim success against the wrong store.

## Goals / Non-Goals

- Goals: choose the managed source that matches the detected binary when inference is safe; fail closed on ambiguous multi-managed untracked installs; refuse managed updates for packages confirmed absent from that manager.
- Non-Goals: change `update --all` skip behavior; adopt/track state as a side effect of every successful untracked update; rewrite installer CLI flags; expand ghost-uninstall coverage.

## Decisions

- Reuse the same binary-path inference already used by `getAdoptableExistingInstallMethod()` when `installedState` is missing.
- If inference identifies a managed method present on the agent, use that installer type.
- If inference is inconclusive and more than one updateable managed method exists, do not pick the preferred package manager; let self-update or manual-hint handle the agent.
- If exactly one updateable managed method exists, keep using it for untracked single-agent updates.
- Before managed update execution, when `probePackagePresence` reports `absent`, return failure without running the update command. Treat `unknown` as inconclusive and proceed, matching ghost-recovery probe semantics.
- Apply the absence guard in the shared package-manager update entry points so both single and batch managed updates inherit it.

## Risks / Trade-offs

- Ambiguous untracked multi-managed agents without an identifiable path may now require self-update or manual action instead of a Bun guess → acceptable; guessing caused false success and duplicate globals.
- Presence probe false `absent` could skip a legitimate update → low risk for Bun/npm probes already used for uninstall ghost recovery; `unknown` remains non-blocking.
