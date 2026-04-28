## Why

`npm publish` currently runs after `build:bin`, so the package tarball for managed installs picks up `dist/bin` and ships every standalone release binary for every platform. A local `npm pack --json` on April 28, 2026 showed a 169 MB tarball with 445 MB unpacked size, which is unnecessary for Bun/npm users and makes managed installs much heavier than the actual JS CLI package.

## What Changes

- Exclude `dist/bin` and other standalone release-only outputs from the published npm package used by Bun/npm installs.
- Add a regression check that proves the managed-install tarball still includes the CLI runtime entrypoints while excluding standalone release binaries.
- Update release/debug runbooks so maintainers know how to validate managed-install package contents when release assets have also been built locally.

## Capabilities

### New Capabilities

- `package-distribution`: Define what the published managed-install package may and may not ship when release-only binaries exist in the working tree.

### Modified Capabilities

- None.

## Impact

- `package.json` packlist behavior for npm/Bun managed installs
- release packaging validation and related tests
- release/debug runbook guidance for validating published package contents
