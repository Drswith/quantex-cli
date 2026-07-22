## MODIFIED Requirements

### Requirement: Release Publishing Prioritizes Primary Artifacts

The Release workflow SHALL publish the repository-owned Core SDK and primary `quantex-cli` npm package on one coordinated version train, publish and verify Core before CLI, attach generated binary artifacts to the GitHub Release, and avoid dispatching or coordinating synchronization for the separate `quantex` npm package from this repository.

#### Scenario: release publishes repository-owned package artifacts

- **WHEN** a release publish run has created the GitHub Release and prepared both repository-owned npm packages
- **THEN** the workflow MUST publish or verify the Core SDK version before publishing `quantex-cli` at the same exact version
- **AND** it MUST upload generated binary artifacts to the GitHub Release
- **AND** it MUST NOT dispatch `sync-quantex-cli-release` or any other synchronization event to `Drswith/quantex`

#### Scenario: Core is published but CLI publication fails

- **GIVEN** the Core SDK exists on npm at the release version
- **AND** `quantex-cli` is missing at that version
- **WHEN** release recovery runs for the latest successful release commit
- **THEN** it MUST verify and skip the existing Core package
- **AND** it MUST retry CLI package validation, publication, and release-asset closure

#### Scenario: CLI exists but Core is missing

- **GIVEN** `quantex-cli` exists on npm at the latest release version
- **AND** the required Core SDK version is missing
- **WHEN** release recovery evaluates that release
- **THEN** it MUST treat npm publication as incomplete
- **AND** it MUST publish and verify Core before declaring repository release closure

#### Scenario: Latest release predates the Core package

- **GIVEN** the latest release commit does not contain `packages/core/package.json`
- **AND** its `quantex-cli` version already exists on npm
- **WHEN** release recovery evaluates that release during the transition
- **THEN** it MUST treat Core as not applicable to that historical release
- **AND** it MUST NOT publish or backfill a Core package for that historical version

#### Scenario: quantex package synchronization credentials are absent

- **WHEN** a release publish run executes without a `QUANTEX_SYNC_TOKEN` secret
- **THEN** the workflow MUST NOT need that secret to complete Core SDK, `quantex-cli`, or GitHub Release artifact publication
- **AND** the workflow MUST NOT treat missing `quantex` package synchronization credentials as relevant to this repository's release success

#### Scenario: Core namespace bootstrap is incomplete

- **WHEN** npm ownership or trusted publishing has not been confirmed for the Core package
- **THEN** release validation MUST fail before publishing either repository-owned npm package for a version that depends on Core
- **AND** it MUST provide an actionable bootstrap diagnostic rather than leaving a partially published CLI dependency

#### Scenario: Core package does not yet exist for trusted publishing

- **GIVEN** npm requires the package to exist before a trusted publisher can be configured
- **WHEN** the first Core release reaches automated publication
- **THEN** the workflow MUST stop before publishing either repository-owned package
- **AND** it MUST instruct an authorized maintainer to publish the validated Core package once with 2FA, configure `release.yml` trust, and rerun
