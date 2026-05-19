## Context

Managed package updates are planned by comparing an agent inspection's installed version with the latest package version. For Bun-managed agents, the installed version can be missing or stale when the agent binary does not expose a package-aligned `--version` output. The batch update then runs `bun update -g` repeatedly and reports successful updates every time.

## Goals / Non-Goals

**Goals:**

- Prefer the installed managed package version when an agent has recorded managed install state and package metadata.
- Keep binary version probing as the fallback for unmanaged installs and managed installers whose package version cannot be inspected.
- Ensure repeated managed Bun updates report `up-to-date` after the installed package version matches latest.
- Recover stale lifecycle locks created by older or interrupted Quantex processes.

**Non-Goals:**

- Do not add a new workflow/orchestration layer for updates.
- Do not change install source selection or package manager update commands.
- Do not broaden the fix to untracked `PATH` installs.

## Decisions

- Add managed package version inspection behind the package-manager abstraction.
  This keeps installer-specific commands in `src/package-manager/` and lets inspection use the same recorded install source that update planning already trusts.
- Use Bun global package listing output for Bun-managed package versions.
  Bun does not currently provide a stable JSON output for this command in the supported runtime, so the parser should be narrow: find the requested package line and extract the version after the package name.
- Use npm's global JSON listing for npm-managed package versions.
  This is a straightforward parity path for the same lifecycle category and avoids making the inspection behavior Bun-only.

## Risks / Trade-offs

- [Bun output format changes] -> The parser is focused on package-name-plus-version tokens and falls back to binary probing when it cannot parse a version.
- [Package version and binary version intentionally differ] -> Recorded managed installs are updated through package-manager metadata, so package version is the more relevant comparison for whether `quantex update` should run again.
- [Lock recovery races with another process] -> Lock recovery only treats a lock as active when the recorded owner PID is alive, then recreates the lock directory atomically and still reports a lock conflict if another process wins the race.
