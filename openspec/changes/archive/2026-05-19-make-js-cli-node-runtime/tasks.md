## 1. OpenSpec And Contract Updates

- [x] 1.1 Add the proposal, design, and spec deltas for the Node-compatible managed runtime contract.
- [x] 1.2 Update product-facing documentation to describe the managed package runtime expectations for npm, Bun, and standalone binaries.

## 2. Runtime Refactor

- [x] 2.1 Replace Bun runtime APIs in `src/` with Node-compatible process, file, and stream helpers.
- [x] 2.2 Switch the published CLI entrypoint to a Node shebang and keep managed self-upgrade registry detection working without `Bun.TOML.parse`.

## 3. Packaging And Validation

- [x] 3.1 Extend package validation so it verifies both the managed-install artifact boundary and Node-based CLI execution.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, `bun run build`, `bun run package:check`, and `bun run openspec:validate`.
