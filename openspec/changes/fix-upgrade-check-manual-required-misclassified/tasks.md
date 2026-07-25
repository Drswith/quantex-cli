## 1. Command-layer fix

- [x] 1.1 Move `manual-required` handling in `upgradeCommand()` above the `--check` / dry-run fallthrough so all modes emit structured `MANUAL_ACTION_REQUIRED`
- [x] 1.2 Keep genuine `check-unavailable` `--check` / dry-run mapping unchanged

## 2. Regression coverage

- [x] 2.1 Add `upgradeCommand({ check: true })` coverage for `manual-required` plans
- [x] 2.2 Add dry-run coverage for `manual-required` plans

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 3.2 Run `bun run openspec:validate` and `bun run memory:check`
