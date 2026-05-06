## MODIFIED Requirements

### Requirement: Release PRs Keep Dedicated Validation

Release-please generated Release PRs SHALL remain governed by the dedicated Release PR validator instead of the product-impacting release-intent check.

#### Scenario: Release-please PR opens

- **WHEN** a pull request comes from a release-please branch
- **THEN** PR Governance does not require product-impacting release intent for the version-file changes
- **AND** Release PR Automerge validates the release branch, title, generated marker, and changed file scope
- **AND** Release PR Automerge MUST load the shared release PR policy implementation from the protected base branch ref for that pull request (for example the pull request base SHA), not from the pull request head commit, so the validation logic cannot be replaced by the PR author
