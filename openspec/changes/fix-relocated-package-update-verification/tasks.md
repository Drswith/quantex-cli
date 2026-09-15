## 1. Observation

- [x] 1.1 Treat package/formula PATH relocation as non-drift when provider version and PATH `--version` disagree
- [x] 1.2 Project the bound provider version as the managed version in that relocation case
- [x] 1.3 Keep same-path version mismatches and provider-reported path conflicts fail-closed

## 2. Tests

- [x] 2.1 Add observation coverage for relocated PATH version lag
- [x] 2.2 Execute the relocated bun-managed update through verification and expect `updated`

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 3.2 Run `bun run openspec:validate` and `bun run memory:check`
