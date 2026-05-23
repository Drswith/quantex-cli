## ADDED Requirements

### Requirement: mise-managed agent lifecycle MUST use mise commands

mise-managed agent lifecycle operations SHALL install, update, batch update, uninstall, diagnose, and report agents through the mise installer when the recorded or selected install source is mise.

#### Scenario: Installing mise-managed agents

- **GIVEN** an agent exposes a mise managed install method
- **WHEN** the user runs `quantex install <agent>` or `quantex ensure <agent>` and that mise method is selected
- **THEN** Quantex runs `mise use --global` with the resolved mise tool reference
- **AND** it records the installed state with install type `mise` and the mise tool reference

#### Scenario: Updating mise-managed agents

- **GIVEN** an agent has recorded install state with install type `mise`
- **WHEN** the user runs `quantex update <agent>`
- **THEN** Quantex selects the mise managed update path
- **AND** it runs `mise use --global --force` with the recorded mise tool reference instead of guessing another package-manager source

#### Scenario: Grouping mise-managed updates

- **GIVEN** multiple installed agents have recorded mise install state
- **WHEN** the user runs `quantex update --all`
- **THEN** Quantex groups those updates by the mise installer
- **AND** it executes mise-managed batch update work without mixing the tool references into Bun, npm, Homebrew, Cargo, pip, uv, or winget groups

#### Scenario: Uninstalling mise-managed agents

- **GIVEN** an agent has recorded install state with install type `mise`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex runs `mise unuse --global` with the recorded mise tool reference
- **AND** it removes the Quantex installed-agent state only after mise reports success

#### Scenario: Reporting mise installer availability

- **WHEN** Quantex reports managed installer availability
- **THEN** the output includes mise availability alongside Bun, npm, Homebrew, Cargo, pip, uv, and winget

#### Scenario: Doctor schema documents mise installer availability

- **WHEN** a user or agent reads `quantex schema doctor`
- **THEN** the `installers` object lists the `mise` installer key that `quantex doctor --json` may emit
- **AND** strict schema validation of real doctor JSON output does not fail solely because the mise installer flag is missing from the published schema
