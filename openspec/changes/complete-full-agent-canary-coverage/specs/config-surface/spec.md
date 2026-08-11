## ADDED Requirements

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
