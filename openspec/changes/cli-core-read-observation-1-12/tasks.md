## 1. OpenSpec and ownership contract

- [x] 1.1 Land proposal, design, and capability deltas for the 1.12 CLI Core read-observation slice
- [x] 1.2 Confirm `inspect` / `info` / `resolve` remain on Core read observation without wrapping public SDK `inspect()`
- [x] 1.3 Keep `release-core.yml` and published `quantex-core` exports unchanged

## 2. Thin CLI facades

- [x] 2.1 Keep or extract shared CLI projection helpers so `inspect` / `info` / `resolve` stay presentation-focused over `resolveCliReadObservation`
- [x] 2.2 Strengthen import-boundary coverage that those commands use Core read observations and do not import the public SDK client for observation
- [x] 2.3 Leave out-of-scope stable commands on their current implementations

## 3. Docs and product memory

- [x] 3.1 Update product README Core transition wording for Core-backed `inspect` / `info` / `resolve`
- [ ] 3.2 Run `bun run openspec:validate` and `bun run memory:check`

## 4. Validation and delivery

- [ ] 4.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`
- [ ] 4.2 Run focused command, Core-read, and `--json` contract tests covering the changed surface
- [ ] 4.3 Commit, push, and open the PR with the repository template (including archive closure for `cli-core-lifecycle-1-12` when riding this delivery)
