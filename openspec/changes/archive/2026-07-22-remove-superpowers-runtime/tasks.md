## 1. Repository-native runtime guidance

- [x] 1.1 Remove Superpowers activation and runtime instructions from `AGENTS.md`, the central runtime skill, and agent-specific runtime bootstraps.
- [x] 1.2 Update current README, OpenSpec, and runbook entry points to use the central runtime skill, OpenSpec, native CLIs, and repository validators.
- [x] 1.3 Update project-memory specification and configuration to make the repository-native runtime the active contract while retaining historical records.
- [x] 1.4 Consolidate historical Superpowers plans and SDD records under `docs/archive/superpowers/` without rewriting their contents.

## 2. Verification and delivery readiness

- [x] 2.1 Confirm no non-historical active manual, runtime configuration, or bootstrap skill references Superpowers.
- [x] 2.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run openspec:validate`, and `bun run memory:check`.
- [x] 2.3 Review OpenSpec status and git state; report commit, push, PR, release, and archive-closure state.
- [x] 2.4 Verify the archive layout and absence of active `.superpowers/` and `docs/superpowers/` paths.
