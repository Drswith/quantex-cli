## 1. Runtime Bootstrap Cleanup

- [x] 1.1 Remove checked-in Claude, Cursor, Gemini, and OpenCode `quantex-agent-runtime` skill bootstrap mirrors.
- [x] 1.2 Keep the central runtime skill and text-first task start entry as the repository workflow source of truth.
- [x] 1.3 Add Codex hosted environment setup metadata without treating it as workflow policy.

## 2. Contract and Validation

- [x] 2.1 Add an OpenSpec project-memory delta for agent-specific workflow file ownership.
- [x] 2.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run openspec:validate`, and `bun run memory:check`.
