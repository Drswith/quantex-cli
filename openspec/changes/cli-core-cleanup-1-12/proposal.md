## Why

Quantex 1.12's four engine-swap slices already route CLI `install`, `ensure`,
`update`, `uninstall`, `list`, `inspect`, `info`, `resolve`, `exec`/`shortcut`,
and `doctor` through in-repo Core. Leftover duplicate CLI lifecycle/service/
executor implementations remain beside those thin facades (deprecated service
re-exports and a second update production bridge). This fifth slice is a
cleanup-only deletion checkpoint: remove dead duplicate engines so promoted
commands stay thin Core projections, without changing frozen contracts.

Work-intake classification: architecture boundaries / ownership cleanup and
durable project-memory archive for the completed doctor slice. OpenSpec
required before edits.

## What Changes

- Delete leftover duplicate CLI lifecycle/service/executor implementations that
  were already moved into in-repo Core, after confirming CLI facades call Core.
- Keep promoted commands as thin projections only: `install`, `ensure`,
  `update`, `uninstall`, `list`, `inspect`, `info`, `resolve`, `exec`, `doctor`.
- Keep `QUANTEX_INSTALLATION_ENGINE=legacy` whole-invocation escape for
  `install` / `ensure` (and v1 `--dry-run` planning on those commands).
- Do **not** change user-facing commands, aliases, `--json`, exit codes, or
  state schema v2.
- Do **not** expand published `quantex-core` public API.
- Do **not** change `release-core.yml`.
- Do **not** change behavior of `upgrade`, `config`, `capabilities`, `commands`,
  `schema`.
- Archive completed OpenSpec change `cli-core-doctor-1-12` as part of this
  delivery (sync accepted doctor deltas into `openspec/specs/`; remove active
  change; do not retain archive dir in the working tree).
- Out of scope: new command surfaces, SDK method growth, Core npm publish,
  legacy-escape removal, rewriting out-of-scope stable commands.

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `runtime-boundaries`: require that duplicate CLI engines already relocated
  into Core be removed, leaving only thin CLI projections and required legacy
  escape wiring for install/ensure.
- `compatibility-contract`: record that this cleanup freezes published SDK /
  CLI contracts and retains the install/ensure legacy escape; sync accepted
  doctor-slice deltas into the main specs as part of archive closure.
- `installation-routing`: extend the thin-projection requirement across the
  promoted 1.12 command set and forbid retaining a second service/executor
  engine beside Core once ownership has moved.
- `product-readme`: sync accepted doctor-slice README wording into the main
  product-readme spec during doctor archive (no new user-facing narrative
  beyond stating cleanup-only / no contract change if README needs a touch).

## Impact

- `src/services/lifecycle-updates.ts` and `src/services/lifecycle-execution.ts`
  deprecated re-exports are removed; callers import Core modules directly.
- `src/services/lifecycle-updates-production.ts` collapses onto Core
  `update-compatibility` / `update-production` instead of owning a second
  plan/execute invocation engine.
- CLI command modules stay presentation/route/exit focused; legacy install/
  ensure escape paths remain.
- Architecture and ownership tests continue to gate Core ownership and forbid
  public SDK re-wraps.
- `openspec/specs/{runtime-boundaries,compatibility-contract,installation-routing,product-readme}`
  receive deltas; doctor active change is archived.
- Validation gate: lint, format:check, typecheck, and existing `--json`
  contract / command tests.
