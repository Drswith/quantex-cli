## 1. Implementation

- [ ] 1.1 Stop `runBunManagedSelfInstall` from calling `bun remove -g` on trust/probe failure or trust-phase interruption while still returning failure.
- [ ] 1.2 Gate shared Bun `add -g` trust-failure rollback in `package-manager/bun` to packages whose pre-add presence was `absent`.
- [ ] 1.3 Update managed-process and package-manager Bun regression tests for preserve-vs-rollback behavior.

## 2. Verification

- [ ] 2.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [ ] 2.2 Run `bun run openspec:validate` and `bun run memory:check`.
- [ ] 2.3 Prepare PR body from the template, run `bun run pr:body:check`, commit, push, and open the PR.
