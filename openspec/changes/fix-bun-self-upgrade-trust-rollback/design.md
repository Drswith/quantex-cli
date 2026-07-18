## Context

Bun self-upgrade and Bun-managed agent install share `bun add -g` plus a post-add trust check. Trust-failure rollback with `bun remove -g` is correct only for packages that were newly added. Self-upgrade always targets an already-present Quantex package through `runBunManagedSelfInstall`, which currently removes Quantex on any trust/probe failure. Shared `package-manager/bun` `add` also removes unconditionally. Pre-redesign PR #457 is stale against these call paths.

## Goals / Non-Goals

**Goals:**

- Preserve an already-present Bun global Quantex install when self-upgrade trust fails.
- Preserve already-present Bun global packages when agent `add -g` trust fails.
- Keep rollback for packages that were conclusively absent before `add`.
- Keep fail-closed success reporting when trust cannot complete.

**Non-Goals:**

- Changing Bun `update -g` trust semantics (already non-removing).
- Switching self-upgrade from install-by-tag to package-manager update semantics.
- Redesigning npm self-upgrade or binary rollback.
- Closing or editing stale PR #457 in-repo; this change supersedes it on current `main`.

## Decisions

- In `runBunManagedSelfInstall`, never call `bun remove -g` on trust/probe failure or trust-phase interruption. Self-upgrade always mutates an existing install; returning failure without uninstall is the safe contract.
- In `package-manager/bun` `add` path, probe each requested package with `probePackagePresence` before add; on trust failure, remove only packages whose pre-add presence was `absent`.
- Leave packages with pre-add presence `present` or `unknown` installed; still return failure.
- Prefer presence-gated shared rollback over a self-only opt-out so agent re-add of an already Bun-global package gets the same safety.

## Risks / Trade-offs

- [Risk] Pre-add presence probe is `unknown` and trust fails → no remove, package may remain. → Acceptable: matches update-path non-removal; better than uninstalling Quantex or an existing agent.
- [Risk] Extra `bun pm -g ls` before each add. → Acceptable for install/self-upgrade correctness.
- [Risk] Fresh install that partially applies then fails trust still rolls back when presence was `absent`. → Desired; preserves fallback-method safety.
