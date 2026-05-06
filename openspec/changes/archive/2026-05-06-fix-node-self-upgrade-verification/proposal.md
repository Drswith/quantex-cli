## Why

Implementation requested work-intake classification: this change modifies observable self-upgrade behavior, so it requires OpenSpec before file edits.

Managed self-upgrade verification currently re-runs `process.execPath` after Bun or npm reports success. Since the published CLI now runs through `#!/usr/bin/env node`, that path resolves to the host Node binary instead of the installed Quantex CLI entrypoint, causing false upgrade failures such as `22.22.2` versus `0.14.0`.

## What Changes

- Make managed self-upgrade verification execute the installed Quantex CLI package entrypoint instead of the host runtime binary.
- Keep binary self-upgrade behavior unchanged so standalone release asset detection and replacement still use the real executable path.
- Add regression coverage for Node-runtime managed installs so successful upgrades no longer fail verification by reading the Node version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `self-upgrade`: managed self-upgrade verification must probe the installed Quantex CLI entrypoint rather than the host Node runtime.

## Impact

- Affected code: `src/self/`, `src/utils/version.ts`, self-upgrade tests.
- Affected behavior: `quantex upgrade` / `qtx upgrade` verification for Bun and npm installs under the Node-based published runtime.
