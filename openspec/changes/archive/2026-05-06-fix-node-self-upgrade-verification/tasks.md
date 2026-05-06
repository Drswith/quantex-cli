## 1. Spec And Design

- [x] 1.1 Document the managed self-upgrade verification regression and the intended verification behavior in proposal, design, and self-upgrade spec deltas.

## 2. Implementation

- [x] 2.1 Update managed self-upgrade verification to probe the installed Quantex CLI entrypoint instead of the host runtime binary.
- [x] 2.2 Add regression tests covering Node-runtime managed self-upgrade verification and fallback behavior.

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`.
- [x] 3.2 Run `bun run test`.
- [x] 3.3 Run `bun run openspec:validate`.
