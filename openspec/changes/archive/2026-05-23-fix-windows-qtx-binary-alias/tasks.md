## 1. Windows Binary Alias Behavior

- [x] 1.1 Add peer alias path derivation for same-directory `quantex.exe` and `qtx.exe` on Windows.
- [x] 1.2 Update delayed Windows binary replacement so a verified replacement refreshes the peer alias copy.
- [x] 1.3 Preserve single-file replacement behavior for custom Windows executable names and non-Windows platforms.

## 2. Documentation And Tests

- [x] 2.1 Document Windows standalone recovery and uninstall guidance for both `quantex.exe` and `qtx.exe`.
- [x] 2.2 Add regression tests for Windows replacement command generation from `qtx.exe`, `quantex.exe`, and a custom executable name.
- [x] 2.3 Add or update provider-level tests so binary self-upgrade passes the Windows alias path through the upgrade flow.

## 3. Validation And Delivery

- [x] 3.1 Run focused self-upgrade tests.
- [x] 3.2 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, `bun run openspec:validate`, and `bun run memory:check`.
- [x] 3.3 Complete delivery closure checks, commit, push, and open a PR for issue #76.
