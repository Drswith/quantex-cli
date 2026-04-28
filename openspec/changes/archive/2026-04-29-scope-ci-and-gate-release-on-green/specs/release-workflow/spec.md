## MODIFIED Requirements

### Requirement: Release Workflow Skips Non-release Pushes

The Release workflow SHALL evaluate release relevance only after merge-gating CI has completed successfully for a protected-branch push, and it SHALL skip release-please for pushes that cannot create a release.

#### Scenario: non-release process merge reaches main

- **WHEN** merge-gating CI completes successfully for a push to `main`
- **AND** the pushed commit has a non-release-worthy conventional commit title such as `docs:`, `ci:`, or `chore:`
- **AND** the commit does not contain breaking-change metadata
- **THEN** the Release workflow MUST complete successfully without invoking release-please

#### Scenario: release-worthy merge reaches main

- **WHEN** merge-gating CI completes successfully for a push to `main`
- **AND** the pushed commit has a release-worthy conventional commit title such as `feat:`, `fix:`, or `perf:`
- **THEN** the Release workflow MUST invoke release-please in Release PR mode
- **AND** the release-please action version MUST be pinned to a repository-verified tag
- **AND** it MUST skip GitHub Release creation in that invocation

#### Scenario: Release PR merge reaches main

- **WHEN** merge-gating CI completes successfully for a push to `main`
- **AND** the pushed commit has a Release PR commit title such as `chore: release 0.4.0`
- **THEN** the Release workflow MUST invoke release-please in GitHub Release mode
- **AND** it MUST skip Release PR creation in that invocation
- **AND** downstream build, publish, and artifact upload steps MUST still depend on release-please reporting `release_created`

#### Scenario: protected-branch CI fails

- **WHEN** merge-gating CI concludes with `failure` for a push to `main` or `beta`
- **THEN** the automated Release workflow MUST NOT create or update a Release PR
- **AND** it MUST NOT publish a GitHub Release, npm package, or binary artifact for that failed push

#### Scenario: manual release dispatch

- **WHEN** the Release workflow is started by `workflow_dispatch`
- **THEN** it MUST invoke release-please regardless of the latest commit metadata
- **AND** the release-please action version MUST be pinned to a repository-verified tag
- **AND** it MUST use GitHub Release mode when the current commit is a Release PR commit
- **AND** it MUST use Release PR mode otherwise
