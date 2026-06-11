## MODIFIED Requirements

### Requirement: Release Workflow Skips Non-release Pushes

The Release workflow SHALL evaluate release relevance only after merge-gating CI has completed successfully for a protected-branch push, and it SHALL reconcile the next release action from protected-branch state instead of trusting a single raw workflow event SHA.

#### Scenario: release-worthy merge reaches main

- **WHEN** merge-gating CI has succeeded for a release-worthy protected-branch commit on `main`
- **AND** there is no newer successful release commit waiting for GitHub Release or npm publication on that branch
- **THEN** the Release workflow MUST invoke release-please in Release PR mode
- **AND** the release-please action version MUST be pinned to a repository-verified tag
- **AND** it MUST skip GitHub Release creation in that invocation

#### Scenario: successful release commit still lacks a tag

- **WHEN** branch history contains a successful protected-branch `chore: release <version>` commit
- **AND** the corresponding `v<version>` tag does not exist yet
- **AND** no semver release tag points at that exact commit
- **THEN** the Release workflow MUST prefer GitHub Release publication for that commit over creating or updating another Release PR

#### Scenario: latest successful release commit has GitHub Release but missing npm package

- **WHEN** branch history contains a successful protected-branch `chore: release <version>` commit
- **AND** that commit is the latest successful release commit on the selected protected branch
- **AND** the corresponding `v<version>` GitHub Release or tag already exists
- **AND** `quantex-cli@<version>` is missing from npm
- **THEN** the Release workflow MUST still choose publish mode for that release commit
- **AND** it MUST rerun package validation, npm publish, and GitHub Release asset upload using the resolver-selected commit and tag

#### Scenario: older release commit is missing from npm

- **WHEN** an older successful release commit has a GitHub Release or tag
- **AND** its `quantex-cli@<version>` package is missing from npm
- **AND** the latest successful release commit is already published to npm
- **THEN** the Release workflow MUST NOT publish the older release commit as part of automatic latest-release recovery

#### Scenario: already tagged release commit has stale title version

- **WHEN** branch history contains a successful protected-branch `chore: release <version>` commit
- **AND** a semver release tag already points at that exact commit
- **AND** `quantex-cli@<version>` is already published to npm
- **THEN** the Release workflow MUST treat that commit as already published
- **AND** it MUST NOT count the stale title version as a pending release commit

#### Scenario: stale successful CI run is older than merged release commit

- **WHEN** a successful protected-branch `CI` run triggers the Release workflow
- **AND** current protected-branch state already contains a newer successful release commit waiting for GitHub Release publication
- **OR** the latest successful release commit is missing from npm
- **THEN** the workflow MUST NOT reopen or refresh Release PR mode from the older CI run
- **AND** it MUST reconcile to the pending publish action instead

#### Scenario: manual recovery uses the same resolver

- **WHEN** a maintainer runs the Release workflow through `workflow_dispatch`
- **THEN** the workflow MUST derive the target protected branch from the dispatch input or current ref
- **AND** it MUST use the same release-target reconciliation rules as automatic runs
- **AND** it MUST NOT bypass the requirement that publish actions come only from a successful protected-branch `CI` run for the selected release commit
