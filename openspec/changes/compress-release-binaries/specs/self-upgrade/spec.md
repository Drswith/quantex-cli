## MODIFIED Requirements

### Requirement: Release artifacts MUST be smoke-validated before publish

The release pipeline SHALL verify that at least the current runner's compressed standalone archive is extractable, contains the expected executable, and matches the generated release metadata.

#### Scenario: Verifying the current runner release archive

- **GIVEN** Quantex has built release binaries, compressed release archives, `SHA256SUMS.txt`, and `manifest.json`
- **WHEN** the release verification workflow runs
- **THEN** it checks that the current runner archive exists in the manifest and checksum file
- **AND** it extracts and executes the archive's expected binary with `--version`
- **AND** the command reports the expected build version

### Requirement: Standalone binary self-upgrade preserves verified archive safety

Standalone binary self-upgrade SHALL verify a release archive before extraction and SHALL only extract the expected executable entry before applying the existing replacement and rollback flow.

#### Scenario: Updating from a compressed standalone archive

- **GIVEN** a standalone binary installation resolves a release archive for its current platform and architecture
- **WHEN** the user runs `quantex upgrade`
- **THEN** Quantex MUST verify the archive SHA-256 before extracting it
- **AND** it MUST reject an archive whose entry is absent, unexpected, or path-unsafe
- **AND** it MUST preserve the existing replacement verification and rollback behavior after successful extraction
