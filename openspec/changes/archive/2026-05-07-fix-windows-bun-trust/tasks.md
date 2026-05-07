## 1. OpenSpec

- [x] 1.1 Create proposal, design, and agent-update spec delta for Windows Bun lifecycle trust behavior.

## 2. Implementation

- [x] 2.1 Update Bun untrusted package parsing to recognize POSIX and Windows path separators.
- [x] 2.2 Keep trust execution scoped to explicitly requested Bun package names.

## 3. Validation

- [x] 3.1 Add regression tests for Windows-style scoped package paths and unrelated blocked packages.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.

## 4. Delivery

- [x] 4.1 Review git state, commit the change, push the branch, and open a PR with a validated body file.
