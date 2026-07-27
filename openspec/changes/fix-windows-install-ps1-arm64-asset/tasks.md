## 1. Installer fix

- [x] 1.1 Map Windows ARM64 hosts in `install.ps1` to the published `quantex-windows-x64.exe` asset
- [x] 1.2 Keep rejecting unknown Windows architectures

## 2. Regression coverage

- [x] 2.1 Add a static test asserting ARM64 no longer requests `quantex-windows-arm64.exe` and resolves to `quantex-windows-x64.exe`

## 3. Validation

- [ ] 3.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [ ] 3.2 Run `bun run openspec:validate` and `bun run memory:check`
