## ADDED Requirements

### Requirement: Release sealing MUST configure an annotated-tag identity

The stable and beta release sealing workflow MUST configure a deterministic repository-local Git committer identity before it creates an annotated immutable version tag.

#### Scenario: immutable release tag does not yet exist

- **WHEN** a validated protected-branch release commit has no corresponding `v<version>` tag
- **THEN** `Seal Release` MUST configure its Git committer name and email before annotated tag creation
- **AND** it MUST create and push the tag at the validated release commit

#### Scenario: immutable release tag already exists

- **WHEN** the corresponding `v<version>` tag already exists
- **THEN** `Seal Release` MUST continue to verify that the tag resolves to the validated release commit
- **AND** it MUST NOT move or recreate the tag
