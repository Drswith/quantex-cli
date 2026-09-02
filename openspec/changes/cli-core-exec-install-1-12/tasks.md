## 1. OpenSpec contract

- [x] 1.1 Land proposal, design, and capability deltas for exec `--install` Core routing
- [x] 1.2 Keep `release-core.yml` and published `quantex-core` exports unchanged
- [x] 1.3 Leave `upgrade` and `config` on their current implementations

## 2. Exec install Core routing

- [x] 2.1 Rewire `lifecycle-execution-production` install port onto Core install/ensure
- [x] 2.2 Preserve frozen `--install` enum, interactive `prompt`, `--json`, stdio inherit, and exit codes
- [x] 2.3 Update ownership / production bridge tests to assert Core install and no `reconcileAgentInstallation`

## 3. Lifecycle zero-reference cleanup

- [x] 3.1 Prove the `src/lifecycle` import graph after the exec install move
- [x] 3.2 Delete only lifecycle files with zero production references; keep CI/`package.json` scripts
- [x] 3.3 Update receipt-contract suite and agent-canary-validation wording for remaining writers

## 4. Docs and product memory

- [x] 4.1 Update bilingual README Core-transition wording for exec `--install` Core install/ensure
- [x] 4.2 Run `bun run openspec:validate` and `bun run memory:check`

## 5. Validation and delivery

- [x] 5.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`
- [x] 5.2 Run exec/shortcut `--json` / `--install` / stdio tests
- [x] 5.3 Commit, push, and open the PR with the repository template
