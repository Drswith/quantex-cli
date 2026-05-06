## MODIFIED Requirements

### Requirement: Protected-branch CI MUST reject prohibited co-author trailers in new commits

Repository CI SHALL reject newly introduced commits on pull requests and protected-branch pushes when their commit messages contain `Co-authored-by:` trailers. PR Governance SHALL also reject pull requests before merge when their commit metadata is likely to make GitHub synthesize prohibited co-author trailers into the final squash merge commit.

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

#### Scenario: Protected-branch push introduces co-author trailer

- **WHEN** CI evaluates the commits introduced by a direct push to a protected branch
- **AND** any of those commit messages contains a `Co-authored-by:` trailer
- **THEN** CI fails before downstream release automation treats the push as releasable history
- **AND** it reports the offending commit SHA and trailer line
