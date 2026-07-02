## Why

When a Bun global install succeeds but post-install trust verification fails, `bun.ts` returns `false` without removing the package that was just added. `installAgent()` then tries the next install method (often npm), leaving duplicate global installs and an untracked Bun copy on disk.

## What Changes

- Roll back Bun global packages when trust verification fails after a successful `bun add -g`.
- Leave update paths unchanged: failed trust after `bun update -g` must not remove an already-installed package.
- Add regression tests for rollback-on-trust-failure and for install fallback after rollback.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: Bun-managed install trust failure after a successful add must roll back the newly installed package before reporting failure.

## Impact

- Affected code: `src/package-manager/bun.ts`, `test/package-manager/bun.test.ts`, `test/package-manager/index.test.ts`.
- No CLI flags, schema version, or command catalog changes.
