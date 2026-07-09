## Why

`quantex install` and `quantex ensure` can adopt an existing PATH-detected agent as a global npm-managed install when the binary path contains `node_modules/.bin` or any `node_modules` segment. Project-local npm installs use those paths, so Quantex can persist the wrong install source and later run global npm update/uninstall against a local binary.

## What Changes

- Restrict npm install-source inference to clearly global npm layouts instead of any `node_modules` path.
- Refuse adoption when the binary path only identifies a project-local npm install.
- Add regression tests for project-local `node_modules/.bin` paths and global npm lib layouts.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: managed install adoption must not treat project-local npm binaries as global npm-managed installs.

## Impact

- Affected code: `src/utils/install.ts`, `test/utils/install.test.ts`.
- No CLI flags, schema version, or command catalog changes.
