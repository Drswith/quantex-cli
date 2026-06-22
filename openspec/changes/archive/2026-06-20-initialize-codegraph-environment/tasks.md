## 1. Environment Setup

- [x] 1.1 Update Codex environment setup to run Bun install with frozen lockfile semantics.
- [x] 1.2 Initialize CodeGraph during Codex environment setup.
- [x] 1.3 Add Codex environment cleanup for transient scratch and package tarball artifacts.
- [x] 1.4 Ignore CodeGraph runtime PID and socket files.

## 2. Validation And Delivery

- [x] 2.1 Run repository baseline validation: `bun run lint`, `bun run format:check`, and `bun run typecheck`.
- [x] 2.2 Run workflow and project-memory validation: `bun run openspec:validate` and `bun run memory:check`.
- [x] 2.3 Directly verify the setup commands with `bun install --frozen-lockfile` and `codegraph init -i`.
- [x] 2.4 Commit, push, validate the PR body, and open the implementation PR.
