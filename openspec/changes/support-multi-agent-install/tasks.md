## 1. OpenSpec

- [x] 1.1 Write the proposal, design, and spec deltas for explicit multi-agent install.

## 2. Implementation

- [x] 2.1 Update the install CLI entry and install command flow to support multiple explicit agents sequentially while preserving single-agent behavior.
- [x] 2.2 Add batch-oriented human, JSON, and NDJSON install reporting for multi-agent requests.
- [x] 2.3 Update stable command/schema metadata if needed so the expanded install surface remains machine-discoverable.

## 3. Coverage And Docs

- [x] 3.1 Add or update tests for single-agent compatibility and multi-agent install outcomes.
- [x] 3.2 Update product README examples to document explicit multi-agent install.

## 4. Validation And Delivery

- [x] 4.1 Run `bun run openspec:validate`.
- [x] 4.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 4.3 Commit, push, and create the implementation PR with a validated PR body.
