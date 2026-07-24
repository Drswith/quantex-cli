## 1. Command-layer fix

- [x] 1.1 Handle `plan.status === 'check-unavailable'` for plain `quantex upgrade` with the same structured `NETWORK_ERROR` result used by `--check`
- [x] 1.2 Ensure the path does not call upgrade mutation and does not throw `Self-upgrade execution did not produce a result.`

## 2. Regression coverage

- [x] 2.1 Add `upgradeCommand()` coverage for `check-unavailable` without `--check`
- [x] 2.2 Keep existing `--check` unavailable coverage green

## 3. Validation and delivery

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`
- [x] 3.2 Commit, push, prepare PR body from the template, run `pr:body:check`, and open the PR
- [x] 3.3 Report remaining owners: archive follow-up after merge; live empty `v1.2.0` recovery remains separate
