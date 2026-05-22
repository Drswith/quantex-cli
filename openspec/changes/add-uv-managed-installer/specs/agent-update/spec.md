## ADDED Requirements

### Requirement: uv-managed agent lifecycle MUST use uv tool commands

uv-managed agent lifecycle operations SHALL install, update, batch update, uninstall, diagnose, and report agents through the uv installer when the recorded or selected install source is uv.

#### Scenario: Installing uv-managed agents

- **GIVEN** an agent exposes a uv managed install method
- **WHEN** the user runs `quantex install <agent>` or `quantex ensure <agent>` and that uv method is selected
- **THEN** Quantex runs `uv tool install` with the resolved package name
- **AND** it preserves any package-specific install arguments declared by the agent definition
- **AND** it records the installed state with install type `uv`, package name, and package install arguments

#### Scenario: Updating uv-managed agents

- **GIVEN** an agent has recorded install state with install type `uv`
- **WHEN** the user runs `quantex update <agent>` or `quantex update --all`
- **THEN** Quantex selects the uv managed update path
- **AND** it runs `uv tool upgrade` with the recorded package name instead of guessing another package-manager source
- **AND** it preserves any recorded package-specific install arguments

#### Scenario: Grouping uv-managed updates

- **GIVEN** multiple installed agents have recorded uv install state
- **WHEN** the user runs `quantex update --all`
- **THEN** Quantex groups those updates by the uv installer
- **AND** it executes uv-managed batch update work without mixing the tool packages into Bun, npm, Homebrew, Cargo, pip, or winget groups

#### Scenario: Uninstalling uv-managed agents

- **GIVEN** an agent has recorded install state with install type `uv`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex runs `uv tool uninstall` with the recorded package name
- **AND** it removes the Quantex installed-agent state only after uv reports success

#### Scenario: Reporting uv installer availability

- **GIVEN** the user runs `quantex capabilities` or `quantex doctor`
- **WHEN** Quantex reports managed installer availability
- **THEN** the output includes uv availability alongside Bun, npm, Homebrew, Cargo, pip, and winget

#### Scenario: Doctor schema documents uv installer availability

- **GIVEN** the user runs `quantex schema doctor` in JSON mode
- **WHEN** Quantex returns the doctor command `dataSchema`
- **THEN** the `installers` object lists the `uv` installer key that `quantex doctor --json` may emit
- **AND** strict schema validation of real doctor JSON output does not fail solely because the uv installer flag is missing from the published schema
