## 1. OpenSpec

- [x] 1.1 Finalize the proposal, design, and spec deltas for release baseline hardening.

## 2. Implementation

- [x] 2.1 Remove the stale `last-release-sha` override from `release-please-config.json`.
- [x] 2.2 Extend Release PR automerge validation to reject non-advancing release versions against the base branch.

## 3. Validation

- [x] 3.1 Add or update automated tests or locally executable validation for the new release-version guard.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.

## 4. Delivery

- [x] 4.1 Review git state, commit the change, push the branch, and open a PR with a validated body file.
