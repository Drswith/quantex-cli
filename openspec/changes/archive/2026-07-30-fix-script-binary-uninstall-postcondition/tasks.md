## 1. Implementation

- [x] 1.1 Branch uninstall command for uninstallable install types (`script` / `binary`) before managed receipt synthesis and PATH/provider postcondition polling
- [x] 1.2 On state-only uninstall success, clear any lifecycle receipt and report success without requiring executable absence
- [x] 1.3 Add command-level regression tests for tracked script and binary uninstall while the executable remains on PATH

## 2. Validation

- [x] 2.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 2.2 Run `bun run openspec:validate`
