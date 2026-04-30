# Tasks: Add CodeBuddy agent support

## 1. OpenSpec and docs

- [x] 1.1 Add the proposal, design, tasks, and `agent-catalog` spec delta for CodeBuddy support.
- [x] 1.2 Update the static supported-agent tables in `README.md` and `README.zh-CN.md`.

## 2. Catalog implementation

- [x] 2.1 Create `src/agents/definitions/codebuddy.ts` with verified lifecycle metadata.
- [x] 2.2 Register and re-export CodeBuddy through `src/agents/index.ts` and `src/index.ts`.
- [x] 2.3 Add test coverage for CodeBuddy lookup aliases, install methods, version probe, and root exports.

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.
