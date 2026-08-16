## 1. OpenSpec contract

- [x] 1.1 Add the proposal, design, and `agent-canary-validation` delta for issue #633.
- [x] 1.2 Record the selected `opencode` real-upgrade anchor, failure semantics, and writer/reader matrix in the change artifacts.

## 2. Real-upgrade canary

- [x] 2.1 Resolve a valid lower stable package version dynamically for the selected smoke agent.
- [x] 2.2 Seed and adopt the older package in the disposable canary environment.
- [x] 2.3 Assert a refreshed `qtx update` is a real upgrade, inspect the written receipt, and let uninstall consume it.
- [x] 2.4 Add focused smoke-source assertions for the real-upgrade scenario and cleanup/error behavior.

## 3. Writer/reader contract test

- [x] 3.1 Capture legacy install receipts across all first-party provider fixtures.
- [x] 3.2 Capture Core install receipts across all first-party provider fixtures.
- [x] 3.3 Capture update receipts across all first-party provider fixtures and reconcile all captured outputs through the uninstall reader bindings.
- [x] 3.4 Assert explicit executable conflicts remain rejected.

## 4. Validation and delivery

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 4.2 Run `bun run openspec:validate` and `bun run memory:check`.
- [x] 4.3 Review git diff/status and report local implementation, repository delivery, PR delivery, release, and archive-closure states separately.
