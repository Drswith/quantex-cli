## 1. Catalog identity

- [x] 1.1 Point every Amp bun/npm candidate in `src/agents/catalog/amp.json` at `@ampcode/cli`
- [x] 1.2 Declare `supersededPackages.npm: ["@sourcegraph/amp"]` on the Amp catalog entry
- [x] 1.3 Regenerate catalog artifacts with `bun run agent-catalog:generate`

## 2. Tests

- [x] 2.1 Assert Amp's reconstructed npm package is `@ampcode/cli` on every platform candidate
- [x] 2.2 Assert `getCatalogSupersededPackages('amp')` lists `@sourcegraph/amp`
- [x] 2.3 Assert a recorded `@sourcegraph/amp` Amp install resolves as superseded rather than as the current package

## 3. Validation and delivery

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 3.2 Run `bun run openspec:validate` and `bun run memory:check`
- [x] 3.3 Open a PR whose body is checked with `bun run pr:body:check`
