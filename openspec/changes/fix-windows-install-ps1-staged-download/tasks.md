## 1. Installer fix

- [x] 1.1 Stage `install.ps1` downloads into a disposable temp directory before replacing live `quantex.exe`
- [x] 1.2 Fail closed when the staged file is missing or empty, clean up temp storage, and copy `qtx.exe` only after a successful replace

## 2. Regression coverage

- [x] 2.1 Add a static test asserting `install.ps1` does not `-OutFile` directly to the live `quantex.exe` path and does stage via a temp directory

## 3. Validation

- [x] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 3.2 Run `bun run openspec:validate` and `bun run memory:check`
