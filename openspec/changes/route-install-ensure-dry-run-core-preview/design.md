## Context

1.12 made CLI `install` / `ensure` apply Core-only and retired `QUANTEX_INSTALLATION_ENGINE=legacy`. `--dry-run` stayed on the v1 observation short-circuit planner because Core preview returned `INSTALL_FAILED` / `decision-indeterminate` under indeterminate provider evidence (reproduced with empty `PATH` against catalog agents whose preferred provider cannot prove package presence), while the frozen planner still emits `ok: true`, `changed: false`, and `DRY_RUN` / "would install".

This P0 change makes Core preview emit that frozen plan, then switches dry-run routing onto Core preview.

## Goals / Non-Goals

**Goals:**

- Core installation `mode: 'preview'` produces the frozen dry-run plan for the PATH/state short-circuit cases the v1 planner already freezes, including indeterminate provider observation.
- CLI `install --dry-run` / `ensure --dry-run` select Core (preview) rather than `dry-run-planning`.
- Preserve `DRY_RUN` (and equivalent frozen fields), `changed: false`, human exit codes, and `--json` fixtures.
- Keep published `quantex-core` public exports unchanged unless a same-repo-only internal preview seam is already required and remains frozen outward.

**Non-Goals:**

- P1 hard deletes of `src/lifecycle` or unused update-planner modules.
- P2 thinning of `*-production` / `*-compatibility`.
- Rewrites of `upgrade` / `config` / `capabilities` / `commands` / `schema`.
- Workflow YAML or independent Core publish.
- Silently accepting plan-JSON drift under indeterminate observation.

## Decisions

1. **Preview-only PATH/state short-circuit inside Core executor**
   - When `mode === 'preview'` and `decideCoreInstallation` blocks as `indeterminate` (and, for planner parity, `conflict`), Core preview synthesizes the same plan the v1 short-circuit planner would: unmanaged / already-installed / would-adopt / would-install / would-reinstall based on `pathExecutable.present`, `installedState`, and the existing private adoption hook.
   - Apply mode stays fail-closed on indeterminate/conflict.
   - Alternative considered: CLI-only remapping of Core failures to `DRY_RUN`. Rejected because ownership would stay outside Core preview and reintroduce dual planners.
   - Alternative considered: changing `decideCoreInstallation` globally. Rejected because apply must remain fail-closed.

2. **Preview mutating plans do not require recipe resolution when synthesizing the frozen short-circuit**
   - The frozen dry-run JSON does not expose method/binding/engine fields. When preview short-circuits from indeterminate observation, return a preview success without calling `resolveRecipe`, matching the planner's "would install" message without selecting a provider.
   - When a normal ready mutating decision can resolve a recipe, keep today's preview path (binding included internally, still omitted from CLI JSON).

3. **Routing: dry-run selects Core; remove dry-run-planning as a live install/ensure route**
   - `selectInstallationEngineRoute('install'|'ensure')` returns the stable Core route even when `dryRun` is set.
   - Command modules always open a Core session for install/ensure; session already maps `dryRun → mode: 'preview'`.
   - Command-local `planInstallDryRun` / `planEnsureDryRun` become unused after the switch; delete those command-local branches in this PR. Do **not** hard-delete broader `src/lifecycle` planners (P1).

4. **Contract freeze gate**
   - Existing dry-run / `--json` / exit-code tests remain authoritative. Add/adjust tests only to pin Core preview ownership and empty-PATH / indeterminate parity.
   - If any frozen plan field still mismatches after preview alignment, stop and document rather than merge drift.

## Risks / Trade-offs

- [Risk] Preview short-circuit could hide apply-time indeterminate failures → Mitigation: apply path unchanged; tests cover apply still fails closed.
- [Risk] Adoption heuristics diverge between planner and Core preview → Mitigation: reuse the same CLI adoption hook already used by Core apply/preview for `external-preserved`.
- [Risk] Residual dead lifecycle planner code confuses ownership → Mitigation: PR explicitly defers P1 deletes; routing tests assert Core is selected for dry-run.

## Migration Plan

1. Land preview alignment + routing switch behind ordinary main merge.
2. No state migration; no release workflow change.
3. Rollback: revert the PR; dry-run planning route can be restored without state repair.

## Open Questions

- None for P0. P1 zero-ref lifecycle deletes wait until this merges and import-graph proof is clean.
