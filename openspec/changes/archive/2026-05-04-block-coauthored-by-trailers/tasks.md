## 1. OpenSpec

- [x] 1.1 Finalize the proposal and spec delta for CI commit-trailer governance.

## 2. Implementation

- [x] 2.1 Add a repository script that rejects `Co-authored-by:` trailers in newly introduced commits.
- [x] 2.2 Wire the script into CI for both pull_request and push events.

## 3. Validation

- [x] 3.1 Add or update automated tests for the commit-trailer policy script.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.

## 4. Delivery

- [x] 4.1 Review git state and prepare the branch for commit, push, and PR delivery.
