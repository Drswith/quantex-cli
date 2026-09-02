## 1. OpenSpec and ownership contract

- [x] 1.1 Land proposal, design, and capability deltas for the 1.12 CLI Core doctor slice
- [x] 1.2 Archive completed `cli-core-exec-1-12` (sync accepted deltas; remove active change; do not retain archive dir in the working tree)
- [x] 1.3 Keep `release-core.yml` and published `quantex-core` exports unchanged (no SDK `doctor` / `diagnose`)

## 2. In-repo Core diagnosis engine

- [x] 2.1 Relocate doctor diagnosis / issue synthesis into `src/core/doctor-diagnosis.ts`
- [x] 2.2 Keep CLI-coupled observation gathering as a thin bridge that injects installer/self/agent facts into Core
- [x] 2.3 Ensure `src/core/index.ts` and `packages/core` exports remain unchanged

## 3. Thin CLI facade

- [x] 3.1 Keep `doctor` presentation-focused over Core diagnosis outcomes
- [x] 3.2 Preserve frozen aliases (none), `--json` shape, installer keys, issue machine ids, and success exit code 0
- [x] 3.3 Strengthen import-boundary coverage that diagnosis ownership uses Core and does not import a public SDK `doctor()` / `diagnose()`
- [x] 3.4 Leave out-of-scope stable commands on their current implementations

## 4. Docs and product memory

- [x] 4.1 Update product README Core transition wording for Core-backed `doctor`
- [x] 4.2 Run `bun run openspec:validate` and `bun run memory:check`

## 5. Validation and delivery

- [x] 5.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`
- [x] 5.2 Run focused doctor `--json` contract and Core diagnosis ownership tests
- [x] 5.3 Commit, push, and open the PR with the repository template (including archive closure for `cli-core-exec-1-12`)
