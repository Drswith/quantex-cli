## MODIFIED Requirements

### Requirement: Protected branches SHALL require aligned status check contexts

The `main` protected branch SHALL require status check contexts that match the consolidated CI workflow job names and actually run on pull requests: `lint`, `governance`, `test (ubuntu-latest)`, `test (windows-latest)`, and `test (macos-latest)`. The `classify` job SHALL NOT be a required context. The `sandbox-tests` workflow SHALL remain advisory and SHALL NOT be a required context.

There is no second protected release branch to mirror: `beta` ceased to be a release channel, and the prerelease-from-main requirement was removed after its release-please mechanism was disproved. The frozen `v1.8.2-beta` tag is registry state rather than repository state; the npm `beta` dist-tag was removed by a maintainer, so no preview dist-tag is currently maintained.

#### Scenario: main branch protection matches CI job names

- **WHEN** a maintainer inspects branch protection for `main`
- **THEN** the required contexts MUST be exactly the five consolidated CI job names
- **AND** `classify` and `sandbox-tests` MUST NOT appear among them
