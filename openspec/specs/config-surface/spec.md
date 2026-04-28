# config-surface Specification

## Purpose
TBD - created by archiving change upgrade-commander-assess-c12. Update Purpose after archive.
## Requirements
### Requirement: User config MUST load from quantex config.json

Quantex SHALL load user configuration from `~/.quantex/config.json`, using the current home-directory resolution rules for the active platform.

#### Scenario: User has a config file

- **WHEN** Quantex resolves user configuration
- **THEN** it reads `config.json` from the Quantex config directory under the active home directory
- **AND** it does not require RC files, YAML, TOML, or config-extension layers to resolve the documented user config surface

### Requirement: User config MUST normalize supported keys

Quantex SHALL merge the config file with built-in defaults and normalize supported keys into the current runtime contract.

#### Scenario: Config file contains supported overrides

- **WHEN** `config.json` contains supported Quantex config keys
- **THEN** Quantex applies those overrides on top of the built-in defaults
- **AND** it normalizes enum and numeric values into the existing runtime shapes used by commands and services

#### Scenario: Config file is missing or invalid

- **WHEN** the user config file does not exist or cannot be parsed as valid JSON
- **THEN** Quantex falls back to built-in defaults
- **AND** it does not require the user to repair the file before non-mutating commands can continue with default settings
