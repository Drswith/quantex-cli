## 1. Regression coverage

- [x] 1.1 Add a command test that `upgradeCommand()` with `check-unavailable` returns structured `NETWORK_ERROR` and does not throw.
- [x] 1.2 Add a command test that `upgradeCommand({ check: true })` with `manual-required` returns structured `MANUAL_ACTION_REQUIRED`.

## 2. Command dispatch

- [x] 2.1 Map `check-unavailable` to `NETWORK_ERROR` before the executed-result guard.
- [x] 2.2 Map `manual-required` before the `--check` / dry-run catch-all so it cannot become `NETWORK_ERROR`.

## 3. Validation and delivery

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 3.2 Run `bun run openspec:validate` and `bun run memory:check`.
- [x] 3.3 Prepare the PR body from the repository template and run `bun run pr:body:check`.
