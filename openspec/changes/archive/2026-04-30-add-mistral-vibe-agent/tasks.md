## 1. OpenSpec And Docs

- [x] 1.1 Write the proposal, design, and catalog spec delta for Mistral Vibe support
- [x] 1.2 Sync the product README supported-agent tables with the current catalog, including Mistral Vibe

## 2. Catalog Implementation

- [x] 2.1 Add `src/agents/definitions/vibe.ts` with official install methods, alias resolution, and version probing
- [x] 2.2 Register Mistral Vibe in `src/agents/index.ts`
- [x] 2.3 Add lookup and install-metadata coverage for Mistral Vibe in the agent registry tests

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`
- [x] 3.2 Run `bun run test` and `bun run openspec:validate`
