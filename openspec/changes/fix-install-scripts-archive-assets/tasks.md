## 1. POSIX installer

- [x] 1.1 Resolve the published `quantex-<platform>-<arch>.tar.gz` archive instead of the raw binary name
- [x] 1.2 Download `SHA256SUMS.txt` from the same release and fail closed on a missing entry or checksum mismatch
- [x] 1.3 Extract only the expected binary entry into temp storage, then `mv` it into `INSTALL_DIR`
- [x] 1.4 Preserve the existing `qtx` symlink and `state.json` install-source recording

## 2. Windows installer

- [x] 2.1 Resolve the host architecture through `PROCESSOR_ARCHITEW6432` before `PROCESSOR_ARCHITECTURE`
- [x] 2.2 Map `AMD64` and `ARM64` to the published x64 asset and keep failing closed on genuine 32-bit hosts
- [x] 2.3 Download `quantex-windows-x64.exe.zip` and `SHA256SUMS.txt` into a disposable temp directory
- [x] 2.4 Verify the archive with `Get-FileHash` before extraction and fail closed on mismatch
- [x] 2.5 Expand the archive, `Move-Item` the expected entry onto `quantex.exe`, refresh `qtx.exe`, and clean up in `finally`

## 3. Regression coverage

- [x] 3.1 Extend `test/install-scripts.test.ts` with archive-asset, checksum, and staged-replacement assertions for both scripts
- [x] 3.2 Keep the existing `install.sh` state-recorder tests passing

## 4. Validation

- [x] 4.1 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`
- [x] 4.2 Run `bun run openspec:validate` and `bun run memory:check`

## 5. Delivery

- [ ] 5.1 Open the implementation PR with a validated body
- [ ] 5.2 Report PR #508 and PR #509 as superseded
