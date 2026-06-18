## MODIFIED Requirements

### Requirement: README Examples Match Current CLI Surface

The root README MUST use command examples and supported-agent references that match the current Quantex CLI surface, including current agent catalog entries and built-in configuration defaults.

#### Scenario: User copies a README command

- **WHEN** a user copies an install, inspect, ensure, update, upgrade, or execution example from `README.md`
- **THEN** the command reflects an existing Quantex command or documented alias.

#### Scenario: User reviews supported agents

- **WHEN** a user reads the supported-agent table in `README.md` or `README.zh-CN.md`
- **THEN** the documented agent names and shortcut commands reflect the current Quantex agent catalog.

#### Scenario: User reviews default configuration

- **WHEN** a user reads the configuration example in `README.md` or `README.zh-CN.md`
- **THEN** the documented values reflect built-in defaults unless the text explicitly labels a value as an optional override.
