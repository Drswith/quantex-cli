# release-workflow Delta

## MODIFIED Requirements

### Requirement: Protected branches SHALL require aligned status check contexts

The `main` protected branch SHALL require status check contexts that match the consolidated CI workflow job names and actually run on pull requests: `lint`, `governance`, `test (ubuntu-latest)`, and `test (macos-latest)`. The `classify` job SHALL NOT be a required context. The `test (windows-latest)` job SHALL continue to run inside `ci.yml` for product-matrix changes as advisory platform signal and SHALL NOT be a required context. The `sandbox-tests` workflow SHALL remain advisory and SHALL NOT be a required context.

There is no second protected release branch to mirror: `beta` ceased to be a release channel, and the prerelease-from-main requirement was removed after its release-please mechanism was disproved. The frozen `v1.8.2-beta` tag is registry state rather than repository state; the npm `beta` dist-tag was removed by a maintainer, so no preview dist-tag is currently maintained.

#### Scenario: main branch protection matches CI job names

- **WHEN** a maintainer inspects branch protection for `main`
- **THEN** the required contexts MUST be exactly `lint`, `governance`, `test (ubuntu-latest)`, and `test (macos-latest)`
- **AND** `classify`, `test (windows-latest)`, and `sandbox-tests` MUST NOT appear among them

#### Scenario: Windows remains visible without gating

- **WHEN** a product-matrix pull request runs `ci.yml`
- **THEN** the `test (windows-latest)` job still executes and appears in Checks
- **AND** a Windows failure MUST NOT by itself make the pull request unmergeable
