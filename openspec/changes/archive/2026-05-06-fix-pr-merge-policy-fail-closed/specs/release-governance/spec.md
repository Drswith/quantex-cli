## MODIFIED Requirements

### Requirement: Protected-branch CI MUST reject prohibited co-author trailers in new commits

Repository CI SHALL reject newly introduced commits on pull requests and protected-branch pushes when their commit messages contain `Co-authored-by:` trailers. PR Governance SHALL also reject pull requests before merge when their commit metadata is likely to make GitHub synthesize prohibited co-author trailers into the final squash merge commit. The merge commit policy validator SHALL fail when no commit metadata is supplied so the check cannot pass silently.

#### Scenario: PR merge commit policy receives no commit metadata

- **WHEN** PR Governance runs the merge commit policy validator
- **AND** no pull request commit metadata is supplied
- **THEN** PR Governance fails before merge
- **AND** it reports that the check cannot run without commit metadata
