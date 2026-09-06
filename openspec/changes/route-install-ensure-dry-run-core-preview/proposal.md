## Why

After 1.12 retired the install/ensure legacy apply escape, `--dry-run` still routes through the retained v1 observation short-circuit planner because Core preview fails closed on indeterminate provider observation (for example empty `PATH`) instead of emitting the frozen dry-run plan. P0 closes that gap so install/ensure dry-run ownership moves to in-repo Core preview without drifting the user-visible contract.

Work-intake classification: observable CLI behavior and architecture-boundary routing change; OpenSpec change required.

## What Changes

- Align in-repo Core installation **preview** with the frozen install/ensure dry-run plan when provider observation is indeterminate (PATH/state short-circuit parity with the maintained v1 planner).
- Route CLI `install --dry-run` and `ensure --dry-run` through Core preview instead of the `dry-run-planning` observation short-circuit route.
- Update installation-routing / runtime-boundaries / compatibility-contract requirements so dry-run is Core-preview-owned while preserving `DRY_RUN`, `changed: false`, human exit codes, and `--json` fixtures.
- Leave `src/lifecycle` hard deletes and unused planner module cleanup for a follow-up P1 after zero-ref proof. Do not expand published `quantex-core` public API. Do not touch `.github/workflows/**` or `release-core.yml`.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `installation-routing`: install/ensure `--dry-run` selects Core preview once Core preview matches the frozen dry-run plan.
- `runtime-boundaries`: install/ensure command modules project Core preview for dry-run; retained short-circuit planner is no longer the selected dry-run route.
- `compatibility-contract`: dry-run routing/compatibility text follows Core preview while freezing the maintained dry-run JSON/human contract.

## Impact

- Code: `src/core/installation-executor.ts` (preview alignment), `src/commands/installation-routing.ts`, `src/commands/install.ts`, `src/commands/ensure.ts`, related tests and thin docs/ADR notes.
- Contracts: OpenSpec deltas above; no command rename, no state schema change, no workflow YAML, no independent Core publish.
- Out of scope: P1 lifecycle deletes, P2 production/compatibility thinning, upgrade/config/capabilities/commands/schema rewrites.
