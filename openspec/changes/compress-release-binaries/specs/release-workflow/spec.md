## MODIFIED Requirements

### Requirement: Release Publishing Prioritizes Primary Artifacts

The Release workflow SHALL publish the primary `quantex-cli` npm package and attach generated compressed standalone binary archives to the GitHub Release without dispatching, notifying, or coordinating synchronization for the separate `quantex` npm package from this repository.

#### Scenario: release publishes compressed standalone artifacts

- **WHEN** a release publish run has created the GitHub Release and generated standalone artifacts are ready to upload
- **THEN** it MUST upload one `.tar.gz` archive for every supported platform and architecture
- **AND** each archive MUST contain its corresponding standalone executable
- **AND** `manifest.json` and `SHA256SUMS.txt` MUST reference and checksum the uploaded archives rather than raw executables
- **AND** it MUST NOT dispatch `sync-quantex-cli-release` or any other synchronization event to `Drswith/quantex`

#### Scenario: quantex package synchronization credentials are absent

- **WHEN** a release publish run executes without a `QUANTEX_SYNC_TOKEN` secret
- **THEN** the workflow MUST NOT need that secret to complete `quantex-cli` npm publishing or GitHub Release artifact upload
- **AND** the workflow MUST NOT treat missing `quantex` package synchronization credentials as relevant to this repository's release success
