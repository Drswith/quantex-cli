## Context

`runGlobalBunCommandWithTrust()` rolls back every requested package with `bun remove -g` when trust fails after `bun add -g`. That is correct for a fresh agent install that needs fallback to another method. Bun-managed self-upgrade intentionally uses the same `install()` / `add` path to install a selected package tag, so an already-present Quantex package inherits destructive rollback.

## Goals / Non-Goals

**Goals**

- Stop Bun self-upgrade trust/probe failure from uninstalling an existing Quantex install.
- Keep rollback for packages that were absent before `bun add -g`.
- Keep fail-closed success reporting when trust cannot be completed.

**Non-Goals**

- Change Bun update (`bun update -g`) trust semantics.
- Switch self-upgrade from install-by-tag to package-manager update semantics.
- Redesign npm self-upgrade or binary rollback.

## Decisions

- Before `bun add -g`, probe each requested package with `probePackagePresence`.
- On trust failure after `add`, call `bun remove -g` only for packages whose pre-add presence was `absent`.
- Packages with pre-add presence `present` or `unknown` are left installed; the managed operation still returns failure.
- Prefer presence-gated rollback over a self-only opt-out flag so agent re-add of an already Bun-global package gets the same safety.

## Risks / Trade-offs

- [Risk] Pre-add presence probe is `unknown` and trust fails → no remove, package may remain. → Acceptable: matches update-path non-removal; better than uninstalling Quantex.
- [Risk] Extra `bun pm -g ls` before each add. → Acceptable for install/self-upgrade correctness.
