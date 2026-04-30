## 1. OpenSpec And Docs

- [x] 1.1 Write the proposal, design, tasks, and agent-catalog delta for OpenHands CLI support
- [x] 1.2 Update supported-agent documentation to list OpenHands separately from Autohand

## 2. Catalog Implementation

- [x] 2.1 Add `src/agents/definitions/openhands.ts` with verified lifecycle metadata
- [x] 2.2 Register and re-export OpenHands without changing the existing Autohand entry
- [x] 2.3 Add tests covering OpenHands lookup, version probing, and official install methods

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`
- [x] 3.2 Run `bun run test` and `bun run openspec:validate`
