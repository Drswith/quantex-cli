# Proposal: windows-bun-residual-shim-lifecycle

## Why

On bun-only Windows machines, the advertised Pi migration (`quantex uninstall pi` then `quantex install pi`) dead-ends. Bun leaves Windows global-bin shims after `bun remove -g` (oven-sh/bun#11970), uninstall reports a leftover copy on PATH, and install then fail-closes because a missing npm executable is treated as inconclusive package presence. Users cannot finish the migration Quantex itself prints.

## What Changes

- Treat a missing package-manager executable (spawn `ENOENT`) as provider-unavailable evidence, not as inconclusive package presence.
- Skip unavailable catalog providers when aggregating install observation, so a missing npm does not block a conclusive bun absence.
- After a successful Bun package removal, reconcile proven leftover Windows shim pairs (`.exe` plus `.bunx`) in Bun's global bin when ownership proof holds; keep the existing POSIX symlink-only cleanup.
- When a leftover Bun global-bin executable remains after bun conclusively reports the package absent and no other exact provider is presence-inconclusive, install observation MUST treat that leftover as non-ownership so decide can select `install` instead of fail-closing or adopting a dead shim.
- Preserve fail-closed behavior when a present PATH executable coincides with a genuinely inconclusive probe from an available provider.
- If a leftover PATH copy still remains after uninstall cleanup, the human failure MUST name the usual Windows shim pair so the user can delete it.
- Add regression coverage for npm spawn `ENOENT` feeding install decide, and for PATH-present + preferred bun absent + alternative unavailable versus alternative indeterminate.

No public command, alias, exit code, state v2, receipt, `--json` schema, or published SDK change. JSON MUST NOT expose engine or route. No YAML / workflow / `release-core.yml` / protect-main changes. Release tagging waits until after merge.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lifecycle-reconciliation`: Missing provider executables are unavailable rather than indeterminate; leftover Bun global-bin shims do not fail-close install decide when bun is conclusively absent and remaining exact providers are only unavailable or absent.
- `agent-uninstall`: Bun uninstall may remove a proven-orphaned Windows `.exe`/`.bunx` shim pair from Bun's global bin, and residual-PATH failures MUST guide deletion of that pair when it remains.

## Impact

- `src/core/provider-observation-registry.ts` — map spawn `ENOENT` to `unavailable`
- `src/core/lifecycle/agent-observation.ts` — skip unavailable candidates; leftover bun-bin path is not live ownership when bun is absent
- `src/package-manager/bun.ts` — Windows shim pair cleanup after conclusive package absence
- `src/core/uninstall-executor.ts` — residual-PATH human guidance for leftover Bun shims
- Tests under `test/core/`, `test/lifecycle/`, `test/package-manager/`
- OpenSpec deltas only; no published SDK, command catalog, or workflow files

## Intake classification

Observable CLI install/uninstall behavior and lifecycle observation semantics; OpenSpec required.
