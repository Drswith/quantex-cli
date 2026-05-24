## MODIFIED Requirements

### Requirement: Release Publishing Prioritizes Primary Artifacts

The Release workflow SHALL publish the primary `quantex-cli` npm package and attach generated binary artifacts to the GitHub Release without dispatching, notifying, or coordinating synchronization for the separate `quantex` npm package from this repository.

#### Scenario: release publishes only primary package artifacts

- **WHEN** a release publish run has created the GitHub Release and published the `quantex-cli` npm package
- **AND** generated binary artifacts are ready to upload
- **THEN** the workflow MUST upload the binary artifacts to the GitHub Release
- **AND** it MUST NOT dispatch `sync-quantex-cli-release` or any other synchronization event to `Drswith/quantex`

#### Scenario: quantex package synchronization credentials are absent

- **WHEN** a release publish run executes without a `QUANTEX_SYNC_TOKEN` secret
- **THEN** the workflow MUST NOT need that secret to complete `quantex-cli` npm publishing or GitHub Release artifact upload
- **AND** the workflow MUST NOT treat missing `quantex` package synchronization credentials as relevant to this repository's release success
