## 1. OpenSpec contract

- [x] 1.1 Land proposal, design, and capability deltas for retiring the install/ensure legacy escape
- [x] 1.2 Keep `release-core.yml` and published `quantex-core` exports unchanged
- [x] 1.3 Leave `upgrade` and `config` on their current implementations

## 2. Core-only install/ensure routing

- [x] 2.1 Make `selectInstallationEngineRoute` return Core for install/ensure regardless of env and dry-run
- [x] 2.2 Collapse CLI `install` / `ensure` onto the Core session path (apply + preview) and remove legacy locked branches
- [x] 2.3 Confirm Core preview preserves maintained v1 dry-run plan fields/messages with no mutation
- [x] 2.4 Update routing and former legacy-env tests so env no longer selects a second engine

## 3. Lifecycle zero-reference cleanup

- [x] 3.1 Prove the `src/lifecycle` import graph after escape removal
- [x] 3.2 Delete only lifecycle files with zero production references; keep modules still used by Core or exec install-if-missing

## 4. Docs and product memory

- [x] 4.1 Update bilingual README Core-transition wording; remove documented env escape / legacy dry-run route
- [x] 4.2 Retire or rewrite `docs/runbooks/core-installation-routing-rollback.md` so it no longer instructs legacy-env recovery
- [x] 4.3 Correct ADR / session notes that still present the escape as current policy
- [x] 4.4 Run `bun run openspec:validate` and `bun run memory:check`

## 5. Validation and delivery

- [x] 5.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`
- [x] 5.2 Run `--json` contract / install / ensure / routing tests including former legacy-env cases
- [x] 5.3 Commit, push, and open the PR with the repository template
