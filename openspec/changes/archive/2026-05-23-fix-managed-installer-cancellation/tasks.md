## 1. OpenSpec

- [x] 1.1 Create the proposal, design, and agent-update spec delta for managed installer cancellation semantics.
- [x] 1.2 Run `bun run openspec:status -- --change fix-managed-installer-cancellation` and follow apply instructions.

## 2. Implementation

- [x] 2.1 Make CLI cancellation handlers awaitable and preserve sticky cancelled state.
- [x] 2.2 Update command runtime signal and timeout handling to wait for cancellation cleanup before returning.
- [x] 2.3 Update managed child process handling to use sticky cancellation and Windows process-tree termination fallback.

## 3. Tests

- [x] 3.1 Add regression coverage for cancellation cleanup joining.
- [x] 3.2 Add regression coverage for success-after-cancel not being treated as managed command success.

## 4. Validation

- [x] 4.1 Run focused tests for command runtime and child process cancellation.
- [x] 4.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.

## 5. Delivery

- [x] 5.1 Commit and push the fix branch.
- [x] 5.2 Prepare a PR body from `.github/pull_request_template.md`, validate it, and open the PR.
