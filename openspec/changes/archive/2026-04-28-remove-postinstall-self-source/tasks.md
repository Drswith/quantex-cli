## 1. Runtime Persistence

- [x] 1.1 Remove the managed-install `postinstall` hook and package it no longer as a runtime requirement.
- [x] 1.2 Keep self install-source persistence working through lazy runtime reconciliation for bun/npm installs with missing state.

## 2. Contract And Coverage

- [x] 2.1 Update package-distribution and self-upgrade tests for the lazy persistence model.
- [x] 2.2 Update runbooks or debugging guidance that currently describe `postinstall` as part of the self-install-source path.

## 3. Validation

- [x] 3.1 Run `bun run openspec:validate`.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run package:check`.
