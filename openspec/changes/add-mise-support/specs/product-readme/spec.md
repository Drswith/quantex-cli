## ADDED Requirements

### Requirement: Product README MUST document mise agent installer support

The product README SHALL explain that mise is supported as an agent lifecycle installer when an agent definition exposes a mise install method, and SHALL show `mise` as a valid `defaultPackageManager` preference.

#### Scenario: User reviews configuration docs

- **WHEN** a user reads the configuration section of the product README
- **THEN** the default package-manager guidance includes `mise` as an option for agent lifecycle installs
- **AND** the self-upgrade guidance remains scoped to Bun, npm, and standalone binary sources
