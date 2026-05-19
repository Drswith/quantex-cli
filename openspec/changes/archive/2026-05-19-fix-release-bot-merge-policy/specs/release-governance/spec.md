## MODIFIED Requirements

### Requirement: Release PRs Keep Dedicated Validation

Release-please generated Release PRs SHALL remain governed by the dedicated Release PR validator instead of the product-impacting release-intent check. PR Governance MUST run the shared Release PR validator for release-please branches before granting any release-specific exception in other local governance checks.

#### Scenario: Release-please PR opens

- **WHEN** a pull request comes from a release-please branch
- **THEN** PR Governance does not require product-impacting release intent for the version-file changes
- **AND** PR Governance MUST first validate the branch, title, generated marker, changed file scope, and version progression with the shared Release PR validator
- **AND** Release PR Automerge validates the release branch, title, generated marker, and changed file scope
- **AND** it rejects a generated Release PR whose proposed semantic version is less than or equal to the current version on the protected base branch

### Requirement: Protected-branch CI MUST reject prohibited co-author trailers in new commits

Repository CI SHALL reject newly introduced commits on pull requests and protected-branch pushes when their commit messages contain `Co-authored-by:` trailers. PR Governance SHALL also reject pull requests before merge when their commit metadata is likely to make GitHub synthesize prohibited co-author trailers into the final squash merge commit. The merge commit policy validator SHALL fail when no commit metadata is supplied so the check cannot pass silently. A single generated commit authored by the repository release bot SHALL be allowed only when PR Governance has already validated that pull request as a release-please Release PR.

#### Scenario: Pull request introduces co-author trailer

- **WHEN** CI evaluates the commits introduced by a pull request targeting a protected branch
- **AND** any of those commit messages contains a `Co-authored-by:` trailer
- **THEN** CI fails before merge
- **AND** it reports the offending commit SHA and trailer line

#### Scenario: Pull request would generate co-author trailer on squash merge

- **WHEN** PR Governance evaluates a pull request targeting a protected branch
- **AND** its commit shape is unsafe for GitHub squash merge under the no-co-author-trailer policy
- **THEN** PR Governance fails before merge
- **AND** it explains how to pre-squash or re-author the pull request commits before retrying

#### Scenario: Validated release PR uses trusted release bot author

- **WHEN** PR Governance has already validated a release-please Release PR with the shared Release PR validator
- **AND** the pull request contains exactly one generated commit authored by the repository release bot identity
- **AND** that commit message does not contain a `Co-authored-by:` trailer
- **THEN** the PR merge commit policy allows that author identity
- **AND** other merge-shape failures such as multiple commits still remain blocking

#### Scenario: PR merge commit policy receives no commit metadata

- **WHEN** PR Governance runs the merge commit policy validator
- **AND** no pull request commit metadata is supplied
- **THEN** PR Governance fails before merge
- **AND** it reports that the check cannot run without commit metadata

#### Scenario: Protected-branch push introduces co-author trailer

- **WHEN** CI evaluates the commits introduced by a direct push to a protected branch
- **AND** any of those commit messages contains a `Co-authored-by:` trailer
- **THEN** CI fails before downstream release automation treats the push as releasable history
- **AND** it reports the offending commit SHA and trailer line
