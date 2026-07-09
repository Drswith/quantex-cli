## 1. OpenSpec Contract

- [x] 1.1 Create the proposal, design, and agent-catalog spec delta for adding Grok Build support.
- [x] 1.2 Confirm OpenSpec status reports the change as ready for apply before implementation delivery.

## 2. Catalog Implementation

- [x] 2.1 Add the Grok Build catalog entry with alias, official script installers, version probe, and self-update.
- [x] 2.2 Regenerate catalog manifests/schema and ensure public exports include `grok`.
- [x] 2.3 Sync product-facing supported-agent lists (README, zh-CN README, agent-support-matrix, skill recipes) with the new catalog entry.

## 3. Tests

- [x] 3.1 Add focused catalog and root export tests for Grok Build lookup, metadata, install methods, and self-update.
- [x] 3.2 Run the focused agent catalog tests before the full validation suite.

## 4. Validation and Delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.
- [x] 4.2 Check git state and delivery closure status, then commit, push, and open a PR if permitted.
