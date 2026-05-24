# release-workflow Spec Delta

## ADDED Requirements

### Requirement: Stable release planning MUST keep pre-major breaking changes on the zero-major line

The stable Release workflow SHALL configure release-please so that breaking changes in a package whose current stable version is below `1.0.0` produce the next `0.x` minor release instead of automatically promoting the package to `1.0.0`.

#### Scenario: breaking change lands while stable version is below 1.0

- **WHEN** release-please plans a stable Release PR from a current version below `1.0.0`
- **AND** the release-worthy history includes a breaking change marker
- **THEN** the generated Release PR MUST propose the next zero-major minor version
- **AND** it MUST NOT propose `1.0.0` unless a future explicit graduation contract allows it
