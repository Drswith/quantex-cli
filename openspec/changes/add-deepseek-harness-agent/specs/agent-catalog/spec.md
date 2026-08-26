## ADDED Requirements

### Requirement: DeepSeek Harness MUST be a supported lifecycle agent

Quantex SHALL include DeepSeek Harness in the supported agent catalog with lifecycle-focused metadata for installation, inspection, resolution, execution, update planning, and stable identification.

#### Scenario: Looking up DeepSeek Harness

- **WHEN** a user or machine consumer looks up the canonical agent name `dsh` or the alias `deepseek-harness`
- **THEN** Quantex returns a supported agent entry for DeepSeek Harness
- **AND** the entry identifies `dsh` as the executable binary
- **AND** the entry identifies `@deepseek-ai/dsh` as its npm package metadata
- **AND** the entry identifies `https://github.com/deepseek-ai/deepseek-harness` as the homepage

#### Scenario: The bare DeepSeek lookup names stay unclaimed

- **WHEN** a user or machine consumer looks up `deepseek` or `deepseek-tui`
- **THEN** Quantex still does not return a supported agent entry for those names
- **AND** adding DeepSeek Harness does not reclaim them, because its canonical name, alias, and display name are all distinct from them

#### Scenario: Installing DeepSeek Harness through supported methods

- **WHEN** Quantex renders or executes install options for DeepSeek Harness
- **THEN** Windows, macOS, and Linux each include the official npm managed install of `@deepseek-ai/dsh`
- **AND** the entry does not declare a `bun`, `brew`, `winget`, `script`, or `binary` method, because upstream documents Node.js with npm as its only distribution and publishes no release binary

#### Scenario: Probing DeepSeek Harness version

- **WHEN** Quantex probes the installed version of DeepSeek Harness
- **THEN** it runs `dsh --version` and parses the output

#### Scenario: Planning a DeepSeek Harness update

- **GIVEN** the entry declares no self-update command, because the launcher grammar exposes only profile boot, `web`, and `plugin`
- **WHEN** Quantex plans an update for a DeepSeek Harness installation
- **THEN** it resolves the recorded npm install source rather than running an agent self-update command
- **AND** an installation Quantex did not record as managed reports manual update guidance
