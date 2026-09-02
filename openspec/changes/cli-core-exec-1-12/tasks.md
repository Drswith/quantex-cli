## 1. OpenSpec and ownership contract

- [ ] 1.1 Land proposal, design, and capability deltas for the 1.12 CLI Core exec/shortcut slice
- [ ] 1.2 Archive completed `cli-core-read-observation-1-12` (sync accepted deltas; remove active change; do not retain archive dir in the working tree)
- [ ] 1.3 Keep `release-core.yml` and published `quantex-core` exports unchanged (no SDK `run` / `exec`)

## 2. In-repo Core execution engine

- [ ] 2.1 Relocate the ports-based agent execution engine into `src/core/execution-executor.ts`
- [ ] 2.2 Keep CLI-coupled production wiring as a thin bridge that injects ports and process I/O policy into Core
- [ ] 2.3 Ensure `src/core/index.ts` and `packages/core` exports remain unchanged

## 3. Thin CLI facades

- [ ] 3.1 Keep `exec` and shortcut presentation-focused over Core execution outcomes
- [ ] 3.2 Preserve `exec --install` policy semantics and shortcut install/prompt defaults
- [ ] 3.3 Strengthen import-boundary coverage that launch ownership uses Core execution and does not import a public SDK `run()` / `exec()`
- [ ] 3.4 Leave out-of-scope stable commands on their current implementations

## 4. Docs and product memory

- [ ] 4.1 Update product README Core transition wording for Core-backed `exec` / shortcut
- [ ] 4.2 Run `bun run openspec:validate` and `bun run memory:check`

## 5. Validation and delivery

- [ ] 5.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`
- [ ] 5.2 Run focused exec/shortcut/`--json`/`--install` and Core execution tests
- [ ] 5.3 Commit, push, and open the PR with the repository template (including archive closure for `cli-core-read-observation-1-12`)
