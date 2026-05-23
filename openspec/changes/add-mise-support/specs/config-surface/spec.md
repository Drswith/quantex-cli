## ADDED Requirements

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
