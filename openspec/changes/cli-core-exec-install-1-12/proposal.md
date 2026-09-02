## Why

Quantex 1.12 already launches `exec` / shortcut through in-repo Core execution,
and CLI `install` / `ensure` already mutate through Core installation. Exec's
`--install` port still calls `reconcileAgentInstallation` on `src/lifecycle`,
leaving a second install engine beside the Core path. Product authorized moving
that port onto the same Core install/ensure engine so lifecycle modules used
only by that escape can be deleted after an import-graph proof.

Work-intake classification: observable CLI routing/behavior and architecture
boundaries. OpenSpec required before edits.

## What Changes

- Move `exec --install` (and shortcut when it shares the launch path) off
  `reconcileAgentInstallation` / `src/lifecycle` onto the in-repo Core
  install/ensure path already used by CLI `install` / `ensure`.
- Freeze user-facing exec/shortcut contracts: public `--install` enum remains
  `never` / `if-missing` / `always` (default `never` on the public flag;
  interactive `prompt` stays interactive-only and is not a JSON policy value);
  `--json` payloads unchanged and MUST NOT expose engine/route; human/interactive
  stdio inherit unchanged; exit codes unchanged.
- After the move, prove the `src/lifecycle` import graph and delete only files
  that become zero-reference. Keep CI/`package.json` scripts.
- Do **not** expand published `quantex-core` public API.
- Do **not** change YAML / `release-core.yml`.
- Do **not** change `upgrade` / `config` behavior.
- Out of scope: new commands/aliases, state schema migration, 2.x identity,
  rewriting update/uninstall observation planners, expanding SDK methods.

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `runtime-boundaries`: require exec/shortcut `--install` mutation to use the
  same in-repo Core install/ensure engine as CLI install/ensure; keep
  presentation/stdio/exit ownership on the CLI bridge.
- `compatibility-contract`: require exec `--install` routing through Core
  installation without changing frozen `--install` enum, JSON payloads, stdio,
  or exit codes; keep published SDK freeze.
- `installation-routing`: clarify that exec/shortcut install-if-missing uses the
  Core install/ensure engine rather than a retained lifecycle reconcile port.
- `agent-canary-validation`: drop the legacy install receipt writer once that
  production path is deleted; keep Core install and managed update writers.
- `product-readme`: note that exec `--install` shares the Core install/ensure
  engine without changing user-facing command recipes.

## Impact

- `src/services/lifecycle-execution-production.ts` stops calling
  `reconcileAgentInstallation` and calls the Core installation compatibility
  bridge instead.
- Proven zero-reference lifecycle modules (expected: `agent-installation`, and
  any modules only reachable through it such as `mutation-planner` /
  `reconcile`) are deleted with matching test cleanup.
- Receipt-contract and ownership tests retarget Core writers / Core install
  seams.
- Validation gate: lint, format:check, typecheck, and exec/shortcut `--json` /
  `--install` / stdio tests.
