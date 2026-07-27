## MODIFIED Requirements

### Requirement: Release Publishing Prioritizes Primary Artifacts

The Release workflow SHALL keep the established `quantex-cli` npm package, GitHub Release, and standalone binaries on one independently recoverable closure. It SHALL build and pack-validate the private Core workspace without querying, publishing, or requiring its provisional npm identity, and SHALL avoid coordinating the separate `quantex` npm package.

#### Scenario: release publishes primary repository artifacts

- **WHEN** a release publish run prepares a validated release commit
- **THEN** the workflow MUST publish or verify `quantex-cli` at the exact release version before creating or refreshing the public GitHub Release
- **AND** it MUST upload generated binary artifacts only after CLI npm closure
- **AND** it MUST NOT publish, registry-inspect, or require the private Core package
- **AND** it MUST NOT dispatch `sync-quantex-cli-release` or any other synchronization event to `Drswith/quantex`

#### Scenario: CLI npm publication fails

- **WHEN** `quantex-cli` publication or exact-version verification fails
- **THEN** the workflow MUST fail before creating a new public GitHub Release for that version
- **AND** a rerun MUST inspect and recover the missing CLI version idempotently

#### Scenario: GitHub Release exists but CLI npm is missing

- **GIVEN** an earlier workflow created the GitHub Release before CLI npm closure
- **WHEN** release recovery evaluates that release commit
- **THEN** it MUST retry CLI validation, publication, and verification
- **AND** it MUST attach standalone artifacts only after the CLI version is visible on npm

#### Scenario: Core package is private

- **GIVEN** the source commit contains `packages/core/package.json`
- **AND** its public package identity has not been activated
- **WHEN** release recovery evaluates CLI closure
- **THEN** a missing or inaccessible Core registry identity MUST NOT block or reopen the CLI release
- **AND** the source package MUST still pass build, boundary, declaration, and clean packed-consumer validation

#### Scenario: npm registry inspection is uncertain

- **WHEN** exact `quantex-cli` registry inspection returns anything other than a verified version or conclusive not-found response
- **THEN** publication MUST fail closed without guessing that the package is missing
- **AND** no new public GitHub Release may be created by that run

#### Scenario: quantex package synchronization credentials are absent

- **WHEN** a release publish run executes without a `QUANTEX_SYNC_TOKEN` secret
- **THEN** the workflow MUST NOT need that secret to complete `quantex-cli` or GitHub Release artifact publication
- **AND** it MUST NOT treat missing `quantex` package synchronization credentials as relevant to this repository's release success

### Requirement: Core publication requires a separate activation contract

The main Release workflow MUST NOT make Core publishing conditional on a mutable readiness variable. Public Core registry publication SHALL be introduced only by a separate OpenSpec change that confirms the final package identity, publisher permission, initial bootstrap, trusted publisher, version policy, and independent recovery behavior.

#### Scenario: a repository variable claims Core is ready

- **WHEN** a variable or secret is added without the Core activation contract and private-manifest removal
- **THEN** the Release workflow MUST continue to omit Core publication
- **AND** CLI release behavior remains unchanged
