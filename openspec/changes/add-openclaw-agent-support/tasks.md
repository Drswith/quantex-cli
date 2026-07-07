# Tasks: Add OpenClaw support

## 1. OpenSpec and docs

- [x] 1.1 Add the proposal, design, tasks, and `agent-catalog` spec delta for OpenClaw support.
- [x] 1.2 Update the static supported-agent tables in `README.md` and `README.zh-CN.md`.

## 2. Catalog implementation

- [x] 2.1 Create `src/agents/catalog/openclaw.json` with verified lifecycle metadata.
- [x] 2.2 Regenerate the catalog manifest via `bun run agent-catalog:generate`.
- [x] 2.3 Register and re-export OpenClaw through `src/agents/index.ts` and `src/index.ts`.

## 3. Tests

- [x] 3.1 Add OpenClaw coverage in `test/agents.test.ts` for install methods, version probe, self-update, canonical-name lookup, and exports.
- [x] 3.2 Add OpenClaw root-export and canonical-name lookup coverage in `test/index.test.ts`.

## 4. Validation

- [x] 4.1 Run `bun run lint`.
- [x] 4.2 Run `bun run format:check`.
- [x] 4.3 Run `bun run typecheck`.
- [x] 4.4 Run `bun run test`.
- [x] 4.5 Run `bun run openspec:validate`.
- [x] 4.6 Run `bun run memory:check`.
