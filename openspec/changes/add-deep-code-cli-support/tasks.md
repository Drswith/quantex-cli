## 1. OpenSpec And Docs

- [x] 1.1 Write proposal, design, and agent-catalog spec delta for Deep Code CLI support
- [x] 1.2 Update supported-agent documentation to list Deep Code CLI

## 2. Catalog Implementation

- [x] 2.1 Add `src/agents/catalog/deepcode.json` with verified lifecycle metadata
- [x] 2.2 Register and re-export Deep Code in agent catalog and root exports
- [x] 2.3 Add tests covering Deep Code lookup, install metadata, version probe, and update-planning metadata

## 3. Validation And Delivery

- [x] 3.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`
- [x] 3.2 Run `bun run test` and `bun run openspec:validate`
- [x] 3.3 Commit, push branch, and open a PR linked to issue #279
