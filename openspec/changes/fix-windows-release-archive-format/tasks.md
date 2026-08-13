## 1. OpenSpec Contract

- [x] 1.1 Record the long-standing v1.8.1 Windows archive-format defect in the proposal, design, and capability deltas

## 2. Platform-Aware Archive Core

- [x] 2.1 Centralize target-to-format and target-to-filename mapping so Windows resolves to `.zip` and Unix targets resolve to `.tar.gz`
- [x] 2.2 Implement deterministic single-entry archive creation for gzip+ustar and ZIP without adding a runtime dependency
- [x] 2.3 Extend safe archive extraction to support ZIP while preserving exact-entry validation and adding ZIP size/CRC checks

## 3. Release and Self-Upgrade Integration

- [x] 3.1 Generate release artifacts through the shared platform-aware archive writer and validate the corrected manifest/checksum matrix
- [x] 3.2 Update binary release URL resolution, release smoke verification, and standalone self-upgrade to consume the corrected Windows ZIP name and extractor

## 4. Regression Coverage

- [x] 4.1 Add release-artifact tests for Windows ZIP naming, manifest requirements, round-trip extraction, and malformed/extra-entry rejection
- [x] 4.2 Update self-upgrade tests to assert the Windows ZIP asset and preserve Unix tarball coverage

## 5. Validation and Delivery

- [x] 5.1 Run lint, format check, typecheck, tests, OpenSpec validation, build, binary build, release-artifact generation, and release dry-run validation
- [ ] 5.2 Commit the implementation, push the dedicated branch, create a governed PR, and verify the PR head/check state
