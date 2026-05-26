## 1. OpenSpec Contract

- [x] 1.1 Create the proposal, design, and agent-catalog spec delta for the safe CodeWhale rename.
- [x] 1.2 Confirm OpenSpec status reports the change as complete before implementation delivery.

## 2. Catalog Implementation

- [x] 2.1 Rename the catalog entry from DeepSeek TUI to CodeWhale and update lifecycle metadata.
- [x] 2.2 Regenerate checked-in catalog exports.
- [x] 2.3 Update root exports, product README tables, and command recipes.

## 3. Tests

- [x] 3.1 Update catalog tests for CodeWhale metadata and removed legacy lookups.
- [x] 3.2 Update root index tests for CodeWhale export and lookup behavior.

## 4. Validation and Delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, `bun run openspec:validate`, and `bun run memory:check`.
- [x] 4.2 Verify the implementation does not modify version files, release manifests, release artifacts, or release workflow behavior.
- [x] 4.3 Commit, push, validate the PR body from `.github/pull_request_template.md`, and open a PR linked to issue `#306` with release intent set to pre-1.0 minor.
