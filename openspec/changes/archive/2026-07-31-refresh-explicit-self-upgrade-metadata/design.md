## Context

Self-upgrade metadata uses a normal cache TTL so passive notices can remain offline. That policy currently also affects the explicit `upgrade` surface, allowing a release published after the cache write to be hidden until expiry. The command-level `--refresh` and `--no-cache` controls already express a caller's intent to bypass cache, but requiring them for the primary upgrade workflow is poor recovery behavior.

## Goals / Non-Goals

**Goals:**

- Make every explicit self-upgrade check and execution resolve fresh version metadata before deciding availability.
- Keep cached metadata useful for non-upgrade, passive notices and avoid introducing network I/O there.
- Retain the global cache controls and their output metadata semantics.

**Non-Goals:**

- Changing registry choice, binary-release manifest fetching, update channels, or the cache TTL for other commands.
- Adding a background refresh, polling, or implicit update behavior.

## Decisions

- Treat the explicit self-upgrade command as an intentional network-aware action and force refresh only for its version-metadata observation. This gives the normal command the same freshness as the existing `--refresh` escape hatch without changing unrelated cache consumers.
- Apply the behavior to both `upgrade --check` and upgrade execution because both depend on the same availability decision. Refreshing only `--check` would leave direct upgrades vulnerable to the same stale result.
- Preserve explicit `--no-cache` / `--refresh` behavior. They remain useful for diagnostics and for any other cache-aware command; the upgrade-specific refresh is additive, not a replacement for global controls.
- Keep the per-operation cache-mode override internal to the self-upgrade path. The package's maintained v1 root declaration is a compatibility boundary, so the existing public `getLatestVersion` signature must not gain the implementation-only option.

## Risks / Trade-offs

- [Explicit upgrade performs one additional registry lookup] → this is within the command's declared network effect and avoids a misleading semantic result.
- [Registry lookup failure after a previously usable cache entry] → retain the current error and recovery behavior rather than silently falling back to stale data during an explicit request for freshness.

## Migration Plan

1. Update the self-upgrade contract and command observation path.
2. Add a regression test that preloads valid but stale version metadata and asserts an explicit check resolves the network version.
3. No state migration is required; existing cache entries remain valid for passive notices.
