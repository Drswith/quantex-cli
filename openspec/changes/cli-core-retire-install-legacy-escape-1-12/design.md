## Context

`selectInstallationEngineRoute` currently maps:

- `update` / `uninstall` → Core stable-default
- install/ensure with `getCliContext().dryRun` → legacy `dry-run-compatibility`
- install/ensure with exact `QUANTEX_INSTALLATION_ENGINE=legacy` → legacy
  `compatibility-escape`
- otherwise install/ensure → Core stable-default

CLI `install` / `ensure` still contain thick legacy locked paths that call
`reconcileAgentInstallation`. Core's compatibility bridge already accepts
`mode: 'preview' | 'apply'` and projects maintained v1 `DRY_RUN` warnings with
the same messages and data shape as the legacy planner.

Product authorized removing the env escape in this 1.12 eighth slice. The
remaining design choice is whether install/ensure `--dry-run` also moves onto
Core preview so the second engine can be fully retired for those commands.

## Goals / Non-Goals

**Goals:**

- Make CLI `install` and `ensure` Core-only for every invocation, including
  `--dry-run`.
- Remove env-selected second-engine branching from route selection and command
  modules.
- Preserve frozen v1 command / JSON / exit / state schema contracts.
- Prove and delete only zero-reference `src/lifecycle` files after the escape
  is gone.
- Update OpenSpec, README, and the rollback runbook so they no longer require
  the escape.

**Non-Goals:**

- Expanding published `quantex-core` API or changing `release-core.yml`.
- Changing `upgrade` / `config` / `capabilities` / `commands` / `schema`.
- Rewriting exec's install-if-missing port away from
  `reconcileAgentInstallation` in this slice.
- Deleting lifecycle modules that still serve Core or exec.
- Changing state schema version or package/binary identity.

## Decisions

### 1. Retire the env escape for install/ensure

`selectInstallationEngineRoute('install' | 'ensure')` always returns the Core
stable-default route. Exact `QUANTEX_INSTALLATION_ENGINE=legacy` (and any other
value) is ignored and does not create a routing mode. Debug stderr continues to
report `engine=core source=stable-default` when `--log-level debug` is set.
Maintained JSON/NDJSON payloads still omit engine/route fields.

**Alternatives considered:** Keep the env escape until a later major — rejected
by product authorization for this slice. Soft-deprecate with a warning but keep
the second engine — rejected because it preserves a dual-engine maintenance
burden without a frozen public contract requiring it.

### 2. Move install/ensure `--dry-run` onto Core preview

Verified: `core-installation-cli` already maps `cliContext.dryRun` to
`mode: 'preview'` and projects the maintained v1 dry-run plan (`changed: false`,
`warnings[].code === 'DRY_RUN'`, adopt/reinstall/install messages matching the
legacy planner, no provider mutation). Prefer Core preview so install/ensure
no longer need a second planning engine.

**Alternatives considered:** Keep dry-run on the legacy planner while removing
only the env escape — rejected because it would leave a second engine solely
for dry-run after product authorized Core-only install/ensure. Reimplement a
CLI-local dry-run planner — rejected as duplicate of Core preview.

### 3. Collapse install/ensure command modules onto the Core session path

Once routing is Core-only, delete the legacy locked branches in `install.ts` /
`ensure.ts` that call `reconcileAgentInstallation` for CLI apply/dry-run. Keep
`installCommandWithRoute` / `ensureCommandWithRoute` as thin test seams that
still accept an explicit Core route.

### 4. Delete only proven zero-reference lifecycle files

After CLI install/ensure stop importing the legacy path, run an import-graph
proof over `src/lifecycle/*`. Delete a file only when no production importer
remains. Expected retention: `agent-installation.ts` and `mutation-planner.ts`
remain while `lifecycle-execution-production` still uses
`reconcileAgentInstallation` for exec install-if-missing; other lifecycle
modules remain Core-shared. Do not expand this slice into rewriting exec.

### 5. Retire escape-dependent product memory

Update installation-routing / compatibility-contract / product-readme specs,
bilingual README transition wording, and either rewrite or retire
`docs/runbooks/core-installation-routing-rollback.md` so it no longer instructs
operators to use `QUANTEX_INSTALLATION_ENGINE=legacy`. ADR 0007 notes that still
describe the escape as current policy are corrected to historical/past tense
for this retirement.

## Risks / Trade-offs

- [Risk] Dry-run JSON silently drifts when switching to Core preview →
  Mitigation: pin existing dry-run `--json` assertions; Core preview messages
  already match; fail the slice if any maintained field changes.
- [Risk] Tests that force `QUANTEX_INSTALLATION_ENGINE=legacy` keep asserting a
  second engine → Mitigation: rewrite those cases to prove env is ignored and
  Core is selected; retarget command suites onto Core/session seams.
- [Risk] Over-deletion of lifecycle modules still used by exec/Core →
  Mitigation: import-graph proof; delete only zero-ref files (same lesson as
  #692).
- [Trade-off] Exec install-if-missing still uses `reconcileAgentInstallation`;
  that is an explicit non-goal follow-up, not evidence that the CLI escape must
  remain.

## Migration Plan

1. Land OpenSpec deltas describing Core-only install/ensure routing.
2. Change route selection and collapse CLI install/ensure onto Core (including
   dry-run preview).
3. Update tests, README, runbook, and ADR wording.
4. Prove lifecycle import graph; delete only zero-ref files.
5. Validate with lint / format:check / typecheck / targeted `--json` and
   routing tests.
6. Ship via normal PR; no Core npm publish required.

## Open Questions

- None. Exec install-port Core rewrite remains a separate follow-up.
