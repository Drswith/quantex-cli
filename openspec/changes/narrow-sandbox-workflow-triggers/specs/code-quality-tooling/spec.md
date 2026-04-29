## MODIFIED Requirements

### Requirement: Modal-backed isolation workflow remains separate from merge-gating CI

The repository SHALL keep Modal-backed isolation validation in a dedicated GitHub Actions workflow instead of adding it to the merge-gating `ci.yml` workflow.

#### Scenario: Documentation-only merge reaches a protected branch

- **WHEN** a merge to `main` or `beta` changes only documentation or OpenSpec archive files
- **THEN** the dedicated Modal sandbox workflow does not run automatically from the protected-branch push
- **AND** maintainers can still start the sandbox workflow manually

#### Scenario: Lifecycle-sensitive merge reaches a protected branch

- **WHEN** a merge to `main` or `beta` changes agent definitions, lifecycle commands, install/update helpers, sandbox scripts, package metadata, or the sandbox workflow itself
- **THEN** the dedicated Modal sandbox workflow runs automatically from the protected-branch push
