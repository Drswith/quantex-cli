# Tasks: Add Devin agent support

## 1. OpenSpec and docs

- [x] 1.1 Add the proposal, design, tasks, and `agent-catalog` spec delta for Devin support.
- [x] 1.2 Update the static supported-agent tables in `README.md` and `README.zh-CN.md`.

## 2. Catalog implementation

- [x] 2.1 Create `src/agents/definitions/devin.ts` with verified lifecycle metadata.
- [x] 2.2 Register and re-export Devin through `src/agents/index.ts` and `src/index.ts`.
- [x] 2.3 Add test coverage for Devin install methods, version probe, self-update, and root exports.

## 3. Validation

- [x] 3.1 Run `bun run lint`.
- [x] 3.2 Run `bun run format:check`.
- [x] 3.3 Run `bun run typecheck`.
- [x] 3.4 Run `bun run test`.
- [x] 3.5 Run `bun run openspec:validate`.
- [x] 3.6 Run `bun run memory:check`.
