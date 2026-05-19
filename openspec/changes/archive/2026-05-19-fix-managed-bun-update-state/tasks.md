## 1. Managed Version Inspection

- [x] 1.1 Add package-manager helpers to inspect installed managed package versions for Bun and npm.
- [x] 1.2 Update agent inspection to prefer recorded managed package versions when available and fall back to binary version probes.

## 2. Regression Coverage

- [x] 2.1 Add focused tests for Bun global package version parsing.
- [x] 2.2 Add update command coverage showing a repeated Bun-managed batch update reports up to date and does not execute Bun update.
- [x] 2.3 Add resource-lock coverage for stale lifecycle lock recovery.

## 3. Validation

- [x] 3.1 Run `bun run openspec:status -- --change fix-managed-bun-update-state` and `bun run openspec:validate`.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
