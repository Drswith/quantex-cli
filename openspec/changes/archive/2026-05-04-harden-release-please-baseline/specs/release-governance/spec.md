## MODIFIED Requirements
### Requirement: Release PRs Keep Dedicated Validation

Release-please generated Release PRs SHALL remain governed by the dedicated Release PR validator instead of the product-impacting release-intent check.

#### Scenario: Release-please PR opens

- **WHEN** a pull request comes from a release-please branch
- **THEN** PR Governance does not require product-impacting release intent for the version-file changes
- **AND** Release PR Automerge validates the release branch, title, generated marker, and changed file scope
- **AND** it rejects a generated Release PR whose proposed semantic version is less than or equal to the current version on the protected base branch
