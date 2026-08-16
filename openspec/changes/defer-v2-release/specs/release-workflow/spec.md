## MODIFIED Requirements

### Requirement: Release-please SHALL run automatically on protected-branch push

On push to `main`, a `release-please` workflow SHALL run using `release-please-config.json`. It SHALL normally open or update the Release PR, but a repository-recorded deferred-major readiness gate MAY temporarily disable Release PR creation while leaving independent eligible-release tag recovery available. `main` remains the only release channel.

#### Scenario: push to main normally opens a Release PR

- **WHEN** a commit is pushed to `main` that is not a release commit
- **AND** no deferred-major preparation gate is active
- **THEN** the release-please workflow MUST run
- **AND** it MUST use `release-please-config.json`
- **AND** it MUST open or update a Release PR for the next version

#### Scenario: deferred v2 pauses Release PR preparation

- **WHEN** a commit is pushed to `main`
- **AND** the temporary stable-v2 readiness gate is active
- **THEN** the release-please workflow MUST run without creating or updating a Release PR
- **AND** its deterministic tag-recovery job MUST remain available for an already merged eligible 1.x Release PR

#### Scenario: no second release branch is configured

- **WHEN** the release automation is inspected
- **THEN** no workflow trigger, branch allowlist, or release-please config file MAY designate a branch other than `main` as a release channel

### Requirement: Major version bumps SHALL require explicit maintainer declaration

A Release PR whose proposed stable version crosses to a new major from a non-zero-major base SHALL be rejected unless the Release PR body carries an explicit maintainer-added `Release-As: <proposed version>` declaration. That declaration satisfies only the generic major-identity check; it SHALL NOT override a separate deferred-major readiness gate.

#### Scenario: Undeclared major bump is rejected

- **WHEN** a generated stable Release PR proposes a new major version over a `1.x` or later base
- **AND** its body does not declare `Release-As: <proposed version>`
- **THEN** the Release PR validator MUST fail with guidance that a maintainer must explicitly approve the new major

#### Scenario: Declared eligible major bump proceeds

- **WHEN** a generated stable Release PR proposes a new major version over a `1.x` or later base
- **AND** its body declares `Release-As: <proposed version>`
- **AND** no separate deferred-major readiness gate rejects the proposed version
- **THEN** the major-bump check passes

#### Scenario: Declared deferred major remains blocked

- **WHEN** a generated stable Release PR proposes a version covered by an active deferred-major readiness gate
- **AND** its body declares `Release-As: <proposed version>`
- **THEN** Release PR validation MUST still fail on readiness
