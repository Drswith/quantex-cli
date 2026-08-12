# config-surface Specification

## Purpose

Define the current observable contract for Quantex user configuration loading and normalization.
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

### Requirement: defaultPackageManager MUST support mise preference

Quantex SHALL allow user configuration to set `defaultPackageManager` to `mise`, causing install method ordering to prefer mise when the current agent exposes a mise managed install method.

#### Scenario: User prefers mise installs

- **GIVEN** `~/.quantex/config.json` contains `"defaultPackageManager": "mise"`
- **WHEN** Quantex resolves install methods for an agent that has a mise method on the current platform
- **THEN** the mise method is ordered before non-mise methods
- **AND** agents without a mise method continue to use their existing candidate method order

#### Scenario: User config contains unsupported defaultPackageManager

- **GIVEN** `~/.quantex/config.json` contains an unsupported `defaultPackageManager` value
- **WHEN** Quantex loads configuration
- **THEN** it normalizes `defaultPackageManager` to the built-in fallback value

### Requirement: defaultPackageManager MUST support uv preference

Quantex SHALL allow user configuration to set `defaultPackageManager` to `uv`, causing install method ordering to prefer uv when the current agent exposes a uv managed install method. Quantex MUST NOT install uv merely because the preference is configured.

#### Scenario: User prefers uv tool installs

- **GIVEN** `~/.quantex/config.json` contains `"defaultPackageManager": "uv"`
- **WHEN** Quantex resolves install methods for an agent that has a uv method on the current platform
- **THEN** the uv method is ordered before non-uv methods
- **AND** agents without a uv method continue to use their existing candidate method order

#### Scenario: Preferred uv executable is unavailable

- **GIVEN** `defaultPackageManager` is `uv` but uv is not installed
- **WHEN** Quantex attempts a uv-selected installation
- **THEN** it reports provider unavailability through the existing installation failure contract
- **AND** it does not bootstrap uv implicitly

