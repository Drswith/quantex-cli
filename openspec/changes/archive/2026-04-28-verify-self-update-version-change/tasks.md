## 1. Self-Update Verification

- [x] 1.1 Add post-update version verification for self-update results when the agent exposes a version probe.
- [x] 1.2 Adjust update result rendering/data so unchanged versions resolve to `up to date` instead of `updated successfully`.

## 2. Regression Coverage

- [x] 2.1 Add tests for a self-update that changes version and for one that returns success without changing version.
- [x] 2.2 Keep existing managed-update and failure-path coverage passing.

## 3. Validation

- [x] 3.1 Run `bun run openspec:validate`.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
