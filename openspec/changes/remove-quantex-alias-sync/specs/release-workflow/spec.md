## MODIFIED Requirements

### Requirement: Release Publishing Prioritizes Primary Artifacts

The Release workflow SHALL publish the primary `quantex-cli` npm package and attach generated binary artifacts to the GitHub Release without dispatching alias-package synchronization from this repository.

#### Scenario: release publishes only primary package artifacts

- **WHEN** a release publish run has created the GitHub Release and published the `quantex-cli` npm package
- **AND** generated binary artifacts are ready to upload
- **THEN** the workflow MUST upload the binary artifacts to the GitHub Release
- **AND** it MUST NOT dispatch `sync-quantex-cli-release` or any other alias-package synchronization event to `Drswith/quantex`

#### Scenario: alias package token is absent

- **WHEN** a release publish run executes without a `QUANTEX_SYNC_TOKEN` secret
- **THEN** the workflow MUST NOT need that secret to complete `quantex-cli` npm publishing or GitHub Release artifact upload
