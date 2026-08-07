## 1. Version probe implementation

- [x] 1.1 Update the shared installed-version probe to parse stdout first and independently fall back to stderr only when stdout produces no version.
- [x] 1.2 Update the production core executable probe with the same stdout-first/stderr-fallback behavior while preserving non-zero exit handling.

## 2. Regression coverage

- [x] 2.1 Extend shared version-probe process fixtures and tests for stderr-only output, stdout precedence, custom parser fallback, and non-zero exits.
- [x] 2.2 Add a production core observation regression for an executable that emits its version only on stderr.

## 3. Validation and contract closure

- [x] 3.1 Run `bun run openspec:validate` and confirm the change artifacts satisfy the agent-version-probing contract.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 3.3 Review the final diff, update completed task checkboxes, and verify the worktree contains no unrelated changes.

## 4. Repository and PR delivery

- [x] 4.1 Commit the implementation and OpenSpec change on the dedicated `codex/fix-stderr-version-probe` branch.
- [x] 4.2 Push the branch and create a PR using the repository template plus `bun run pr:body:check`.
- [x] 4.3 Inspect the PR checks and report local implementation, repository delivery, PR delivery, merge delivery, release closure, and OpenSpec archive closure separately.
