## ADDED Requirements

### Requirement: Product README MUST document uv agent installer preference

The English and Simplified Chinese product READMEs SHALL explain that uv is supported as an agent lifecycle installer when an agent definition exposes a uv method, and SHALL show `uv` as a valid `defaultPackageManager` preference without implying that Quantex installs uv automatically.

#### Scenario: User reviews uv configuration guidance

- **WHEN** a user reads the configuration section of either product README
- **THEN** the default package-manager guidance includes `uv` as an option for agent lifecycle installs
- **AND** the guidance states that the corresponding package-manager executable must already be available
- **AND** self-upgrade guidance remains scoped to its existing supported sources
