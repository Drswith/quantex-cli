## 1. Catalog Support

- [x] 1.1 Add `src/agents/definitions/deepseek.ts` with verified DeepSeek TUI lifecycle metadata.
- [x] 1.2 Register DeepSeek TUI in `src/agents/index.ts` and `src/index.ts`.
- [x] 1.3 Add the DeepSeek TUI requirement to `openspec/specs/agent-catalog/spec.md`.

## 2. Tests And Docs

- [x] 2.1 Add or update automated tests for DeepSeek TUI metadata, lookup aliases, and root exports.
- [x] 2.2 Sync `README.md` and `README.zh-CN.md` supported-agent tables with the implemented catalog.

## 3. Validation

- [x] 3.1 Run `bun run lint`.
- [x] 3.2 Run `bun run format:check`.
- [x] 3.3 Run `bun run typecheck`.
- [x] 3.4 Run `bun run test`.
- [x] 3.5 Run `bun run openspec:validate`.
