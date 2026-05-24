# release-workflow Spec Delta

## ADDED Requirements

### Requirement: Stable release planning MUST keep pre-major breaking changes on the zero-major line

The stable Release workflow SHALL configure release-please so that breaking changes in a package whose current stable version is below `1.0.0` produce the next `0.x` minor release instead of automatically promoting the package to `1.0.0`.

#### Scenario: breaking change lands while stable version is below 1.0

- **WHEN** release-please plans a stable Release PR from a current version below `1.0.0`
- **AND** the release-worthy history includes a breaking change marker
- **THEN** the generated Release PR MUST propose the next zero-major minor version
- **AND** it MUST NOT propose `1.0.0` unless a future explicit graduation contract allows it

### Requirement: Burned stable release versions MUST NOT be reused

The stable Release workflow SHALL treat `1.0.0` as a burned stable release version because that npm version was already published and deprecated after the accidental pre-1.0 promotion.

#### Scenario: release automation proposes a burned stable version

- **WHEN** release-please creates or updates a stable Release PR
- **AND** the proposed version is `1.0.0`
- **THEN** Release PR validation MUST reject the PR before automerge
- **AND** a future 1.0 graduation MUST choose a different publishable stable version
