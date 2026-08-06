## 1. OpenSpec contract

- [x] 1.1 Create the proposal and design for current release/uninstall documentation alignment
- [x] 1.2 Add delta specs for product README, release workflow, code-quality tooling, and project-memory contracts

## 2. Product-facing guidance

- [x] 2.1 Update `README.md` and `README.zh-CN.md` with stable-line/beta-selector clarification
- [x] 2.2 Document managed uninstall ownership and residual `PATH` behavior in both product READMEs
- [x] 2.3 Add the `conflicting-source` residual-PATH recovery path to the troubleshooting runbook

## 3. Current repository guidance

- [x] 3.1 Remove stale beta-branch references from the central runtime, current CI/project-memory specs, and worktree/release runbooks
- [x] 3.2 Correct the current release spec, audit-session follow-up, and release-seal contract comment without rewriting historical ADRs

## 4. Validation and handoff

- [x] 4.1 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`
- [x] 4.2 Run `bun run test`, `bun run openspec:validate`, and `bun run memory:check`
- [x] 4.3 Confirm the dedicated branch is based on `origin/main`, the primary `main` worktree remains clean and synchronized, and report commit/push/PR/archive closure states explicitly
