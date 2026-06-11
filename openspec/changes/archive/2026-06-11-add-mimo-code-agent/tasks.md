## 1. OpenSpec Contract

- [x] 1.1 Create the proposal, design, and agent-catalog spec delta for adding MiMoCode support.
- [x] 1.2 Confirm OpenSpec status reports the change as complete before implementation delivery.

## 2. Catalog Implementation

- [x] 2.1 Add the MiMoCode catalog entry with aliases, npm package metadata, official install methods, and version probe.
- [x] 2.2 Update generated catalog manifests and public exports.
- [x] 2.3 Update the current agent-catalog spec so archive closure preserves the accepted MiMoCode contract.

## 3. Tests

- [x] 3.1 Add focused catalog and root export tests for MiMoCode lookup, metadata, install methods, and self-update absence.
- [x] 3.2 Run the focused agent catalog tests before the full validation suite.

## 4. Validation and Delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.
- [x] 4.2 Check git state and delivery closure status, then commit, push, and open a PR if permitted.
