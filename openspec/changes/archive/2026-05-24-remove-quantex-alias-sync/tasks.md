## 1. Release Workflow

- [x] 1.1 Remove the `quantex` package repository dispatch step from `.github/workflows/release.yml`.
- [x] 1.2 Confirm no active workflow or release documentation still requires `QUANTEX_SYNC_TOKEN`.

## 2. Documentation And Spec

- [x] 2.1 Add the OpenSpec release-workflow delta for removing `quantex` package synchronization from this repository.
- [x] 2.2 Update release collaboration documentation to state that `quantex` package update synchronization is owned entirely by the `quantex` project.

## 3. Validation

- [x] 3.1 Run `bun run openspec:status -- --change remove-quantex-alias-sync`.
- [x] 3.2 Run `bun run openspec:validate`.
- [x] 3.3 Run `bun run lint`, `bun run format:check`, and `bun run typecheck`.
- [x] 3.4 Run `bun run test`.
- [x] 3.5 Run `bun run build`, `bun run build:bin`, and `bun run release:artifacts`.
