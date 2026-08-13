## MODIFIED Requirements

### Requirement: Release Publishing Prioritizes Primary Artifacts

The Release workflow SHALL publish the primary `quantex-cli` npm package and attach generated compressed standalone binary archives to the GitHub Release without dispatching synchronization for the separate `quantex` npm package from this repository.

#### Scenario: release publishes compressed standalone artifacts

- **WHEN** a release publish run has created the GitHub Release and generated standalone artifacts are ready to upload
- **THEN** it MUST upload one archive for every supported platform and architecture
- **AND** macOS and Linux assets MUST use the `.tar.gz` format
- **AND** the Windows executable asset MUST use the `.zip` format
- **AND** each archive MUST contain exactly its corresponding standalone executable
- **AND** `manifest.json` and `SHA256SUMS.txt` MUST reference and checksum the uploaded archives
- **AND** it MUST NOT dispatch synchronization events to external `quantex` packages
