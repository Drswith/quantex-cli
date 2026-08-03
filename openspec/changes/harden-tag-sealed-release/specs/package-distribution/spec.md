## ADDED Requirements

### Requirement: Published Package MUST Match the Validated Release Candidate

The `quantex-cli` npm version SHALL be published from the exact tarball contained in the validated release-candidate artifact. Publication MUST NOT run a new pack or build step after candidate validation.

#### Scenario: npm version is absent

- **WHEN** publication confirms that `quantex-cli@<version>` is not present in the registry
- **THEN** it MUST publish the candidate tarball file directly with the channel derived from the validated tag
- **AND** it MUST verify the published version and integrity before completing the release

#### Scenario: npm version exists during retry

- **WHEN** publication finds `quantex-cli@<version>` in the registry
- **THEN** it MUST compare the registry integrity with the candidate tarball integrity
- **AND** it MUST continue only when they match

### Requirement: Standalone Release Assets MUST Match the Validated Release Candidate

Every standalone binary, manifest, and checksum attached to a GitHub Release SHALL come from the same validated release-candidate artifact as the npm tarball.

#### Scenario: release assets are staged

- **WHEN** publication creates or recovers the GitHub Release for a validated tag
- **THEN** it MUST upload or reconcile only the candidate artifact's standalone assets
- **AND** it MUST verify the expected asset names and sizes before npm publication
