## 1. Implementation

- [x] 1.1 Return `false` from `updateAgentsByType` when the filtered package list is empty so grouped updates do not treat installer no-ops as success.
- [x] 1.2 Add unit tests covering empty and all-blank package name inputs.

## 2. Spec and validation

- [x] 2.1 Sync `openspec/specs/agent-update/spec.md` and change-local spec delta with the new requirement.
- [x] 2.2 Run `bun run openspec:validate`, `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
