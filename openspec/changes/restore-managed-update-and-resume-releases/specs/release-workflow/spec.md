## MODIFIED Requirements

### Requirement: Release-please SHALL run automatically on protected-branch push

On push to `main`, a `release-please` workflow SHALL run using `release-please-config.json`. It SHALL open or update the Release PR for the next version. `main` remains the only release channel.

A deferred-major readiness gate SHALL NOT be implemented by suppressing Release PR creation. Denial of an ineligible major belongs to the layers that name a version — generated Release PR validation, deterministic tag planning, and publication identity validation — so an ordinary eligible release on the current major is never blocked as a side effect.

#### Scenario: push to main opens a Release PR

- **WHEN** a commit is pushed to `main` that is not a release commit
- **THEN** the release-please workflow MUST run
- **AND** it MUST use `release-please-config.json`
- **AND** it MUST open or update a Release PR for the next version

#### Scenario: an ineligible major is proposed while a readiness gate is active

- **WHEN** conventional commits on `main` would compute a major version that a readiness gate denies
- **THEN** Release PR preparation MUST still run
- **AND** the generated Release PR MUST be rejected by Release PR validation rather than prevented from existing
- **AND** the deterministic tag-recovery job MUST remain available for an already merged eligible Release PR

#### Scenario: no second release branch is configured

- **WHEN** the release automation is inspected
- **THEN** no workflow trigger, branch allowlist, or release-please config file MAY designate a branch other than `main` as a release channel
