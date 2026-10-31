## 1. Helper script contract

- [x] 1.1 Emit the Windows delayed-replacement script as newline-separated statements
- [x] 1.2 Pass the script to `powershell.exe` with `-EncodedCommand` (UTF-16LE base64)
- [x] 1.3 Keep backup-before-swap, verify-and-rollback, peer-copy, `windowsHide`, and success-on-schedule behavior

## 2. Regression coverage

- [x] 2.1 Decode the scheduled helper in tests and assert each `try` stays adjacent to its `catch`
- [x] 2.2 Assert the spawned argv uses `-EncodedCommand` rather than a semicolon-joined `-Command` string
- [x] 2.3 Keep existing Windows helper coverage (apostrophe escape, backup abort, swap rollback, peer alias)

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 3.2 Run `bun run openspec:validate` and `bun run openspec:status -- --change fix-windows-upgrade-helper-parse`
