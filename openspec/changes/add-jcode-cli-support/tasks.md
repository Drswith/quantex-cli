## 1. OpenSpec And Docs

- [x] 1.1 Write the proposal, design, tasks, and `agent-catalog` delta for `jcode` support
- [x] 1.2 Update supported-agent documentation to list `jcode`

## 2. Catalog Implementation

- [x] 2.1 Add `src/agents/definitions/jcode.ts` with verified lifecycle metadata
- [x] 2.2 Register and re-export `jcode` in the agent catalog
- [x] 2.3 Add tests covering `jcode` lookup, version probing, install methods, and missing self-update metadata

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`
- [x] 3.2 Run `bun run test` and `bun run openspec:validate`

## 4. Delivery

- [x] 4.1 Commit the change on a dedicated branch
- [x] 4.2 Push the branch and open a pull request with a validated PR body
