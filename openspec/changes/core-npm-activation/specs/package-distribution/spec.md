## ADDED Requirements

### Requirement: Core uses its final public package identity and version line

The Core SDK SHALL be named `quantex-core` and SHALL be publicly publishable. Its version SHALL be independent from the root CLI version, while the root development dependency MUST pin the exact Core workspace version without introducing a published runtime dependency or a workspace protocol.

#### Scenario: public Core package is packed
- **WHEN** the Core package is built and packed
- **THEN** its manifest identifies `quantex-core` and its exact Core version
- **AND** it exposes only its documented root and package metadata subpaths

#### Scenario: root CLI is packaged
- **WHEN** the root CLI package is packed
- **THEN** it contains no runtime dependency on `quantex-core`
- **AND** it remains runnable without Core installed from npm
