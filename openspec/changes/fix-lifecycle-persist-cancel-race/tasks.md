## 1. Lifecycle persistence guard

- [x] 1.1 Re-check cancellation after `setInstalledAgentState()` and roll back written state when cancelled
- [x] 1.2 Route `trackInstalledAgent()` through the cancellation-aware persistence helper
- [x] 1.3 Handle `null` persistence results in install and ensure adopt/track paths

## 2. Regression coverage

- [x] 2.1 Add package-manager tests for cancellation during slow state persistence
- [x] 2.2 Add package-manager test for cancelled `trackInstalledAgent()`

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 3.2 Run `bun run openspec:validate`
