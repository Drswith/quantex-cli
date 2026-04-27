## ADDED Requirements

### Requirement: Supported agent catalog entries MUST expose verified lifecycle metadata

The supported agent catalog SHALL expose verified canonical names, lookup aliases, install methods, package metadata, binary names, and self-update commands for each newly supported agent when upstream documentation provides them.

#### Scenario: Adding a newly supported agent with documented install and upgrade paths

- **WHEN** Quantex adds support for a newly documented CLI such as Kilo Code CLI
- **THEN** the catalog entry includes the verified package name, binary name, canonical homepage, and available install methods
- **AND** the entry exposes any verified self-update command through lifecycle surfaces such as `info`, `list`, and `update`

#### Scenario: Resolving a supported agent by canonical name or published alias

- **WHEN** a user refers to a supported agent by its canonical Quantex name or a published upstream alias
- **THEN** Quantex resolves the same catalog entry
- **AND** lifecycle commands operate on that agent without requiring a separate duplicate definition
