## 1. OpenSpec

- [x] 1.1 Create a follow-up OpenSpec change for the e2e-discovered Windows wrapper cleanup ordering issue.
- [x] 1.2 Link the follow-up to the archived #237 cancellation contract without editing archived task state.

## 2. Implementation

- [x] 2.1 Update managed child process termination so Windows process-tree cleanup runs before direct wrapper termination.

## 3. Tests

- [x] 3.1 Add an isolated e2e smoke script that runs a real Quantex runtime path with a fake Cargo-managed install.
- [x] 3.2 Add a sandboxed e2e test that asserts timeout output, no success rendering, no installed-agent state persistence, and no fake installer completion.

## 4. Validation

- [x] 4.1 Run `bun run test -- test/managed-installer-cancellation.e2e.test.ts`.
- [x] 4.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, `bun run openspec:validate`, and `bun run memory:check`.

## 5. Delivery

- [x] 5.1 Commit and push the follow-up fix branch.
- [x] 5.2 Prepare a PR body from `.github/pull_request_template.md`, validate it, and open the PR.
