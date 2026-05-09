## MODIFIED Requirements
### Requirement: Release Workflow Skips Non-release Pushes

The Release workflow SHALL evaluate release relevance only after merge-gating CI has completed successfully for a protected-branch push, and it SHALL reconcile the next release action from protected-branch state instead of trusting a single raw workflow event SHA.

#### Scenario: release-worthy merge reaches main

- **WHEN** merge-gating CI has succeeded for a release-worthy protected-branch commit on `main`
- **AND** there is no newer successful untagged `chore: release ...` commit waiting on that branch
- **THEN** the Release workflow MUST invoke release-please in Release PR mode
- **AND** the release-please action version MUST be pinned to a repository-verified tag
- **AND** it MUST skip GitHub Release creation in that invocation

#### Scenario: successful release commit still lacks a tag

- **WHEN** branch history contains a successful protected-branch `chore: release <version>` commit
- **AND** the corresponding `v<version>` tag does not exist yet
- **THEN** the Release workflow MUST prefer GitHub Release publication for that commit over creating or updating another Release PR

#### Scenario: stale successful CI run is older than merged release commit

- **WHEN** a successful protected-branch `CI` run triggers the Release workflow
- **AND** current protected-branch state already contains a newer successful untagged `chore: release ...` commit
- **THEN** the workflow MUST NOT reopen or refresh Release PR mode from the older CI run
- **AND** it MUST reconcile to the pending publish action instead

#### Scenario: manual recovery uses the same resolver

- **WHEN** a maintainer runs the Release workflow through `workflow_dispatch`
- **THEN** the workflow MUST derive the target protected branch from the dispatch input or current ref
- **AND** it MUST use the same release-target reconciliation rules as automatic runs
- **AND** it MUST NOT bypass the requirement that publish actions come only from a successful protected-branch `CI` run for the selected release commit
