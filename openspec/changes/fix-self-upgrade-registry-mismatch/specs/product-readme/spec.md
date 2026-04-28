## ADDED Requirements

### Requirement: README warns that self-upgrade follows the active registry

The product README SHALL explain that `qtx upgrade` uses the registry selected for the current Bun/npm self-upgrade path and that mirrors can lag behind the official npm release.

#### Scenario: User reads upgrade guidance while using a mirror

- **WHEN** a user reads the installation or upgrade guidance in `README.md` or `README.en.md`
- **THEN** the documentation explains that `qtx upgrade` follows the active Bun/npm registry
- **AND** it warns that a lagging mirror can delay installation of the newest upstream release
