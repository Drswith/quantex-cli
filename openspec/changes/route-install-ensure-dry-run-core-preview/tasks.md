## 1. Core preview frozen-plan alignment

- [x] 1.1 Add preview-only PATH/state short-circuit in `src/core/installation-executor.ts` when decide is blocked as indeterminate (and conflict for planner parity), synthesizing frozen would-install / would-reinstall / already-installed / unmanaged / adopt preview outcomes without apply mutation
- [x] 1.2 Ensure apply mode remains fail-closed on indeterminate/conflict; preview mutating short-circuit does not require recipe resolution when synthesizing the frozen plan
- [x] 1.3 Add Core executor tests covering empty-PATH / indeterminate preview → frozen dry-run-equivalent success, and apply still fails closed

## 2. CLI dry-run routing switch

- [x] 2.1 Change `selectInstallationEngineRoute` so install/ensure `--dry-run` selects Core instead of `dry-run-planning`
- [x] 2.2 Remove install/ensure command branches that call the retained observation short-circuit dry-run planners; always use Core session (preview via existing dryRun→preview mapping)
- [x] 2.3 Update installation-routing and install/ensure tests to assert Core preview ownership while keeping frozen DRY_RUN / changed:false / exit-code / --json fixtures

## 3. Specs, docs, and validation

- [x] 3.1 Sync root OpenSpec specs / thin ADR or runbook notes that still say dry-run stays on the retained planner
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, targeted dry-run/routing/Core preview tests, and `bun run openspec:validate` / `bun run memory:check` as needed
- [x] 3.3 Commit, push, open draft PR with freeze confirmation, residual planner usage notes, and explicit P1-delete out-of-scope
