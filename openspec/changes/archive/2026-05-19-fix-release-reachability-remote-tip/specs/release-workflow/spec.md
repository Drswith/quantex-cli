## MODIFIED Requirements
### Requirement: Release Workflow Skips Non-release Pushes

The Release workflow SHALL evaluate release relevance only after merge-gating CI has completed successfully for a protected-branch push, and it SHALL skip release-please for pushes that cannot create a release.

#### Scenario: release-worthy merge reaches main

- **WHEN** merge-gating CI completes successfully for a push to `main`
- **AND** the pushed commit has a release-worthy conventional commit title such as `feat:`, `fix:`, or `perf:`
- **THEN** the Release workflow MUST invoke release-please in Release PR mode
- **AND** the release-please action version MUST be pinned to a repository-verified tag
- **AND** it MUST skip GitHub Release creation in that invocation
- **AND** it MUST derive the next release from the current manifest and published release state instead of a stale repository-pinned baseline override
- **AND** it MUST resolve that action from successful protected-branch CI history instead of blindly trusting a single raw workflow event SHA

#### Scenario: successful release commit is pending publication

- **WHEN** branch history contains a successful protected-branch `chore: release <version>` commit
- **AND** the corresponding `v<version>` tag does not exist yet
- **THEN** the Release workflow MUST publish that release commit before it creates or updates another Release PR

#### Scenario: manual release recovery uses branch-state reconciliation

- **WHEN** a maintainer runs the Release workflow manually for `main` or `beta`
- **THEN** the workflow MUST resolve the target action from the same successful CI history and branch release state used by automatic runs
- **AND** it MUST NOT bypass the requirement that publish actions come only from a successful protected-branch CI run for the chosen release commit

#### Scenario: release target resolver has its runtime before resolution

- **WHEN** the Release workflow checks out a protected branch source on a fresh runner
- **THEN** it MUST bootstrap the runtime needed by the release-target resolver before invoking repository scripts that decide publish vs Release PR vs skip
- **AND** it MUST NOT defer that runtime installation until after a release is already created

#### Scenario: CI run reachability uses reconciled remote branch tip

- **WHEN** the Release workflow has fetched `refs/remotes/origin/<protected_branch>` and tags
- **THEN** release-target reconciliation MUST treat successful `CI` runs as reachable only if the run `head_sha` is an ancestor of the reconciled remote tip for that protected branch
- **AND** it MUST NOT rely on a local branch tip that may still point at an older commit after fetch-only updates to `refs/remotes/origin/<protected_branch>`
