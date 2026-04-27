## ADDED Requirements

### Requirement: Release Workflow Skips Non-release Pushes

The Release workflow SHALL skip release-please for pushes that cannot create a release.

#### Scenario: Documentation-only push reaches main

- **GIVEN** a push to a release branch has a non-release conventional commit such as documentation, workflow, or OpenSpec archive maintenance
- **WHEN** the Release workflow runs
- **THEN** it MUST complete successfully without invoking release-please
- **AND** it MUST skip release artifact, publish, and upload steps

#### Scenario: Release-worthy push reaches main

- **GIVEN** a push to a release branch has release-worthy conventional commit metadata, breaking-change metadata, or a release PR merge commit
- **WHEN** the Release workflow runs
- **THEN** it MUST invoke release-please
- **AND** downstream build, publish, and artifact upload steps MUST still depend on release-please reporting `release_created`

#### Scenario: Manual release workflow dispatch

- **GIVEN** a maintainer manually dispatches the Release workflow
- **WHEN** the workflow starts
- **THEN** it MUST invoke release-please regardless of the latest commit metadata
