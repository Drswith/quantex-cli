## ADDED Requirements

### Requirement: Core publication is independent and OIDC-backed

The repository SHALL publish `quantex-core` only through a manually dispatched `release-core.yml` workflow with GitHub Actions OIDC. The workflow MUST not require an npm token, invoke CLI release-please, create a GitHub Release, upload standalone binaries, or gate CLI publication on Core registry state.

#### Scenario: maintainer dispatches a Core release
- **WHEN** a maintainer dispatches `Release Core` for `main`
- **THEN** the workflow builds and validates only the Core package contract before publishing
- **AND** npm receives an OIDC-authenticated `quantex-core` publish without a long-lived npm credential

#### Scenario: Core publication is unavailable
- **WHEN** Core registry inspection or publication fails
- **THEN** the workflow fails without publishing an ambiguous version
- **AND** `release.yml` remains able to publish and recover `quantex-cli` independently

### Requirement: Core releases use immutable, idempotent recovery sources

The Core release workflow MUST use `core-v<version>` as its immutable source tag and inspect `quantex-core@<version>` before publishing. It MUST reject a tag pointing at another commit and MUST treat an exact existing npm version as already published.

#### Scenario: a Core release is retried
- **WHEN** a maintainer dispatches Core release after an interrupted publish
- **THEN** the workflow reuses the existing matching `core-v<version>` tag
- **AND** it publishes only if the exact package version is conclusively absent

#### Scenario: tag and requested source disagree
- **WHEN** `core-v<version>` points at a different commit from the selected source
- **THEN** the workflow fails before npm publication
