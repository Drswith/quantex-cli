## 1. Regression coverage

- [x] 1.1 Add an uninstall regression that simulates successful managed removal, conclusive provider absence, and residual PATH presence
- [x] 1.2 Assert installed-agent state is not restored, the lifecycle receipt is cleared, and the result is conflicting-source
- [x] 1.3 Keep existing provider-still-present and cancellation retain-evidence regressions green

## 2. Uninstall postcondition restore path

- [x] 2.1 After postcondition failure, re-observe the bound provider before restoring evidence
- [x] 2.2 When the provider is conclusively absent, skip state restore, clear the receipt, and return conflicting-source
- [x] 2.3 When the provider remains present or evidence is indeterminate, retain installed-agent state and return verification-failed

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 3.2 Run `bun run openspec:validate`
