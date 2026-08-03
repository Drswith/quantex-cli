## 1. Release archive generation

- [x] 1.1 Define compressed release asset names and generate one archive per standalone target.
- [x] 1.2 Generate the manifest, checksums, candidate, and GitHub assets from compressed archives.
- [x] 1.3 Extend release artifact and smoke validation to validate archive contents.

## 2. Standalone self-upgrade

- [x] 2.1 Resolve archive assets for platform/architecture and retain actionable recovery links.
- [x] 2.2 Verify and safely extract a downloaded archive before binary replacement.
- [x] 2.3 Cover archive upgrade success and malformed archive rejection.

## 3. Documentation and validation

- [x] 3.1 Update the release runbook's artifact contract and local validation instructions.
- [x] 3.2 Run the required release, OpenSpec, and repository validation suite.
