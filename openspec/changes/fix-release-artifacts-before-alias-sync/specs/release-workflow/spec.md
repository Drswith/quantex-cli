## ADDED Requirements

### Requirement: Release Publishing Prioritizes Primary Artifacts

The Release workflow SHALL attach generated binary artifacts to the GitHub Release before running auxiliary downstream synchronization that is not required for those artifacts to be available.

#### Scenario: alias synchronization fails after publish

- **WHEN** a release publish run has created the GitHub Release and published the npm package
- **AND** generated binary artifacts are ready to upload
- **THEN** the workflow MUST upload the binary artifacts before dispatching alias-package synchronization
- **AND** an alias-package synchronization failure MUST NOT prevent those binary artifacts from being attached to the GitHub Release
