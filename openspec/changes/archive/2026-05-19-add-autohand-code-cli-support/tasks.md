# Tasks: Add Autohand Code CLI support

## 1. OpenSpec

- [x] 1.1 Add the OpenSpec proposal, design, tasks, and agent-catalog delta for Autohand Code CLI support

## 2. Implementation

- [x] 2.1 Create `src/agents/definitions/autohand.ts` with verified lifecycle metadata and register it in the exported agent catalog
- [x] 2.2 Add tests covering Autohand lookup, exports, version probe metadata, and official installer commands
- [x] 2.3 Update product-facing supported-agent tables to include Autohand and keep the catalog list synchronized

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`
