## 1. OpenSpec and routing contract

- [x] 1.1 Land proposal, design, and capability deltas for the 1.12 CLI Core lifecycle slice
- [x] 1.2 Expand installation/lifecycle routing types and selection so `update` / `uninstall` default to Core with whole-invocation legacy escape
- [x] 1.3 Keep `install` / `ensure` dry-run on the legacy planning route; keep `run` off Core

## 2. In-repo Core engines (no public SDK expansion)

- [x] 2.1 Relocate the ports-based update engine into `src/core/` with production and compatibility bridges that do not import CLI presentation modules
- [x] 2.2 Extract the uninstall engine into `src/core/` with production and compatibility bridges
- [x] 2.3 Ensure `src/core/index.ts` and `packages/core` exports remain unchanged (no new SDK methods)
- [x] 2.4 Confirm `release-core.yml` is untouched

## 3. Thin CLI facades

- [x] 3.1 Point `install` / `ensure` Core routes through the existing Core installation compatibility bridge without re-adding engine logic to the command modules
- [x] 3.2 Replace default `update` / `uninstall` CLI paths with thin facades over the new Core bridges, retaining legacy escape
- [x] 3.3 Keep `list` on the existing Core read observation path without wrapping public SDK `list()` into a second CLI-shaped API
- [x] 3.4 Leave remaining frozen stable commands on their current implementations

## 4. Docs and product memory

- [x] 4.1 Update product README Core transition wording for the 1.12 CLI slice and frozen SDK surface
- [x] 4.2 Run `bun run openspec:validate` and `bun run memory:check`

## 5. Validation and delivery

- [x] 5.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`
- [x] 5.2 Run focused Core, command, routing, and `--json` contract tests covering the changed surface
- [x] 5.3 Commit, push, and open the PR with the repository template stating 1.12 intent and the frozen compatibility surface
