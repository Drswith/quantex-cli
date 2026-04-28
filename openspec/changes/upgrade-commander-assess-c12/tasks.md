## 1. Dependency And Config Loader

- [x] 1.1 Upgrade `commander` to the latest stable v14 release and refresh the lockfile.
- [x] 1.2 Replace the `c12` config loader with a direct JSON config loader that preserves the documented `~/.quantex/config.json` contract.
- [x] 1.3 Remove `c12` from dependencies if the direct loader keeps behavior and tests intact.

## 2. Contract And Regression Coverage

- [x] 2.1 Add or update OpenSpec artifacts to define the supported config file surface.
- [x] 2.2 Update tests to verify loading and normalizing config directly from `config.json`.

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
