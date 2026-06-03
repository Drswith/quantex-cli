## 1. OpenSpec Contract

- [x] 1.1 Create the proposal, design, and agent-catalog spec delta for the Kimi Code TypeScript CLI migration.
- [x] 1.2 Confirm OpenSpec status reports the change as complete before implementation delivery.

## 2. Catalog Implementation

- [x] 2.1 Update the Kimi catalog entry to the current homepage, npm package metadata, official script URLs, npm managed install methods, and `kimi upgrade` self-update command.
- [x] 2.2 Update the current agent-catalog spec so archive closure will preserve the accepted Kimi and uv metadata contract.

## 3. Tests

- [x] 3.1 Update Kimi catalog tests for npm metadata, install methods, script URLs, and self-update behavior.
- [x] 3.2 Run the focused agent catalog test before the full validation suite.

## 4. Validation and Delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.
- [x] 4.2 Check git state and delivery closure status, then commit, push, and open a PR if permitted.
