## Context

After the 1.12 lifecycle, read-observation, exec, and doctor slices, CLI facades
already call in-repo Core for the promoted command set. Two classes of leftover
remain:

1. Deprecated 2-line service re-exports (`src/services/lifecycle-updates.ts`,
   `src/services/lifecycle-execution.ts`) that only forward Core executors.
2. A second update production bridge (`src/services/lifecycle-updates-production.ts`)
   that reimplements the Core `update-compatibility` invocation state machine
   while Core already owns `update-compatibility.ts` + `update-production.ts`.

Install/ensure still correctly retain a whole-invocation legacy engine for
`QUANTEX_INSTALLATION_ENGINE=legacy` and v1 `--dry-run` planning. That escape
is not dead code.

ADR 0007 requires a named deletion checkpoint after each migrated path. This
slice is that checkpoint for the already-migrated engines, not a fifth engine
swap.

## Goals / Non-Goals

**Goals:**

- Remove confirmed-dead duplicate engines and re-exports after verifying CLI
  facades call Core.
- Collapse the CLI update production adapter onto Core update-compatibility /
  update-production, keeping only CLI cancellation/timeout/operation-context
  wrapping.
- Keep thin projections for install, ensure, update, uninstall, list, inspect,
  info, resolve, exec, doctor.
- Preserve `QUANTEX_INSTALLATION_ENGINE=legacy` whole-invocation escape for
  install/ensure.
- Archive `cli-core-doctor-1-12` (sync accepted deltas; remove active change).
- Keep architecture/import-boundary and `--json` contract tests green.

**Non-Goals:**

- Changing user-facing commands, aliases, `--json`, exit codes, or state schema
  v2.
- Expanding published `quantex-core` public API or changing `release-core.yml`.
- Changing upgrade, config, capabilities, commands, schema behavior.
- Removing the install/ensure legacy escape or dry-run legacy planning route.
- Rewriting exec's install port onto Core installation in this slice (behavior-
  sensitive; optional follow-up).
- Deleting `src/services/update.ts` / root v1 compatibility exports.
- Deleting `lifecycle-observations` while legacy install/ensure still need it.

## Decisions

### 1. Delete deprecated service re-exports; import Core directly

Point callers of `services/lifecycle-updates` and `services/lifecycle-execution`
at `src/core/update-executor` and `src/core/execution-executor`. Update
`src/services/index.ts` and ownership tests that asserted the shim files.
Deleting the shims is behavior-neutral and removes a false second home for
engine types.

**Alternatives considered:** Keep shims indefinitely for import stability —
rejected because ADR 0007 requires deletion checkpoints and the shims are
already marked `@deprecated`.

### 2. Thin the update production bridge onto Core update-compatibility

Rewrite `lifecycle-updates-production.ts` as a thin CLI adapter that:

- creates CLI operation context (cancellation / timeout / registerCleanup)
- delegates the plan/execute invocation state machine to
  `createCoreSingleAgentUpdateInvocation` /
  `createCoreUpdateBatchInvocation`
- retains the existing CLI observation/lock port wiring
  (`createProductionLifecycleObservationService`, `withAgentLifecycleLock`,
  `getAllAgents` batch listing) so v1 `--json` / exit / lock contracts do not
  drift

Do **not** switch observation onto Core `update-production` ports in this
cleanup slice: that would replace a retained compatibility surface and risk
user-visible contract drift. Public Core index and packages/core exports stay
unchanged (no `update` SDK method).

**Alternatives considered:** Leave the duplicate bridge forever — rejected as
the named deletion target. Move observation onto Core `update-production` now —
rejected for this freeze because it changes mockable/compatibility port wiring
and failed the v1 update baseline. Move CLI operation context into Core —
rejected because Core must stay free of CLI context / presentation imports.

### 3. Keep required legacy install/ensure paths and observation helpers

Do not delete legacy blocks in `install.ts` / `ensure.ts`,
`reconcileAgentInstallation`, or `lifecycle-observations` used by that escape.
installation-routing and compatibility-contract still forbid early legacy
removal.

### 4. Archive doctor before or with cleanup delivery

Sync accepted `cli-core-doctor-1-12` deltas into `openspec/specs/` for
runtime-boundaries, compatibility-contract, and product-readme, then remove the
active doctor change from the working tree (no archive directory retained).
Follow the same in-PR archive pattern used when doctor archived exec.

### 5. Strengthen ownership tests, do not expand SDK surface

Adjust ownership tests so update routes through Core update modules and
deprecated shims are gone. Keep forbidding `createQuantex` / public SDK
`update` / `run` / `doctor` on CLI paths. Do not touch `release-core.yml`.

## Risks / Trade-offs

- [Risk] Thinning update production onto Core ports changes observation wiring
  and drifts `--json` / lock / cancellation outcomes → Mitigation: existing
  update command tests, lifecycle-updates-production tests (rewired), and
  architecture/ownership suites are the gate; no intentional payload changes.
- [Risk] Removing deprecated re-exports breaks overlooked internal imports →
  Mitigation: repo-wide import search before delete; typecheck + focused tests.
- [Risk] Over-deleting legacy install/ensure escape → Mitigation: explicit
  non-goal; installation-routing tests and rollback runbook remain.
- [Trade-off] Exec still installs missing agents through legacy
  `reconcileAgentInstallation` in the production bridge; deferring that
  consolidation avoids a behavior-sensitive mid-invocation engine mix.

## Migration Plan

1. Archive `cli-core-doctor-1-12` (sync accepted deltas; remove active change).
2. Land OpenSpec cleanup deltas.
3. Rewire deprecated shim callers to Core; delete shim files.
4. Collapse update production bridge onto Core update-compatibility /
   update-production; update ownership tests.
5. Validate with lint / format:check / typecheck and focused `--json` /
   ownership / architecture tests.
6. Ship as part of 1.12 minor via release-please after merge; no Core npm
   publish required; no contract change.

## Open Questions

- None for this slice.
