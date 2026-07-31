## MODIFIED Requirements

### Requirement: Release Workflow Is Explicit and Idempotent

The Release workflow SHALL run only through `workflow_dispatch` for `main` or `beta`. It SHALL reconcile the selected protected branch into either Release PR preparation, publish/recovery, or a no-op, and every publication retry SHALL use the same immutable release commit.

#### Scenario: latest successful release commit has npm package but incomplete GitHub Release assets

- **WHEN** branch history contains a successful protected-branch `chore: release <version>` commit
- **AND** that commit is the latest successful release commit on the selected protected branch
- **AND** the corresponding `v<version>` GitHub Release or tag already exists
- **AND** `quantex-cli@<version>` is already published to npm
- **AND** the GitHub Release is missing one or more required artifacts (`manifest.json`, `SHA256SUMS.txt`, or a required platform binary)
- **THEN** the Release workflow MUST still choose publish mode for that release commit
- **AND** it MUST rebuild and upload the missing GitHub Release assets using the resolver-selected commit and tag
- **AND** it MUST NOT treat npm publication alone as sufficient to skip artifact recovery

#### Scenario: GitHub Release asset inspection is indeterminate

- **WHEN** branch history contains a successful protected-branch `chore: release <version>` commit
- **AND** that commit is the latest successful release commit on the selected protected branch
- **AND** `quantex-cli@<version>` is already published to npm
- **AND** GitHub Release asset inspection cannot determine whether the required artifact matrix is complete
- **THEN** release-target resolution MUST fail closed
- **AND** it MUST NOT select skip or Release PR mode for that release commit

#### Scenario: maintainer retries a partial release

- **WHEN** a maintainer runs the Release workflow through `workflow_dispatch`
- **AND** the selected release commit already has a tag or GitHub Release but its npm package or artifacts are incomplete
- **THEN** the workflow MUST use the selected immutable release commit
- **AND** it MUST verify or publish `quantex-cli` before attaching artifacts
- **AND** it MUST NOT create a second release or require a different control-source checkout
