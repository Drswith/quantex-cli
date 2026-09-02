## 1. OpenSpec archive and cleanup contract

- [x] 1.1 Land proposal, design, and capability deltas for the 1.12 CLI Core cleanup slice
- [x] 1.2 Archive completed `cli-core-doctor-1-12` (sync accepted deltas into `openspec/specs/`; remove active change; do not retain archive dir in the working tree)
- [x] 1.3 Keep `release-core.yml` and published `quantex-core` exports unchanged

## 2. Delete leftover duplicate engines

- [x] 2.1 Rewire callers of deprecated `src/services/lifecycle-updates.ts` and `src/services/lifecycle-execution.ts` to Core modules, then delete the shims
- [x] 2.2 Collapse `src/services/lifecycle-updates-production.ts` onto Core `update-compatibility` / `update-production` (CLI keeps only operation-context wrapping)
- [x] 2.3 Preserve `QUANTEX_INSTALLATION_ENGINE=legacy` and install/ensure `--dry-run` legacy planning paths
- [x] 2.4 Leave upgrade, config, capabilities, commands, and schema on their current implementations

## 3. Ownership and thin-projection coverage

- [x] 3.1 Update ownership / architecture tests so update routes through Core update modules and deprecated shims are gone
- [x] 3.2 Confirm promoted command facades remain thin projections and do not import public SDK `update` / `run` / `doctor` methods
- [x] 3.3 Keep import-boundary tests green for Core ownership

## 4. Docs and product memory

- [x] 4.1 Sync product-readme / compatibility / runtime-boundary wording for doctor archive and cleanup-only freeze
- [x] 4.2 Touch README only if needed to avoid implying contract changes from cleanup; keep legacy escape documented
- [x] 4.3 Run `bun run openspec:validate` and `bun run memory:check`

## 5. Validation and delivery

- [x] 5.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`
- [x] 5.2 Run existing `--json` contract / command tests plus ownership / architecture suites as the no-drift gate
- [x] 5.3 Commit, push, and open the PR with the repository template stating cleanup-only / no contract change (including archive closure for `cli-core-doctor-1-12`)
