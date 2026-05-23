## ADDED Requirements

### Requirement: Deno-managed agent lifecycle MUST use Deno global executable commands

Deno-managed agent lifecycle operations SHALL install, update, batch update, uninstall, diagnose, and report agents through the Deno installer when the recorded or selected install source is Deno.

#### Scenario: Installing Deno-managed agents

- **GIVEN** an agent exposes a Deno managed install method
- **WHEN** the user runs `quantex install <agent>` or `quantex ensure <agent>` and that Deno method is selected
- **THEN** Quantex runs `deno install --global` with the resolved package or URL specifier
- **AND** it preserves any package-specific install arguments declared by the agent definition
- **AND** it records the installed state with install type `deno`, package name, package install arguments, and executable name

#### Scenario: Updating Deno-managed agents

- **GIVEN** an agent has recorded install state with install type `deno`
- **WHEN** the user runs `quantex update <agent>` or `quantex update --all`
- **THEN** Quantex selects the Deno managed update path
- **AND** it runs `deno install --global --force` with the recorded package or URL specifier instead of using project dependency update commands
- **AND** it preserves any recorded package-specific install arguments

#### Scenario: Grouping Deno-managed updates

- **GIVEN** multiple installed agents have recorded Deno install state
- **WHEN** the user runs `quantex update --all`
- **THEN** Quantex groups those updates by the Deno installer
- **AND** it executes Deno-managed batch update work without mixing the packages into Bun, npm, Homebrew, Cargo, pip, uv, or winget groups

#### Scenario: Uninstalling Deno-managed agents

- **GIVEN** an agent has recorded install state with install type `deno`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex runs `deno uninstall --global` with the recorded executable name
- **AND** it removes the Quantex installed-agent state only after Deno reports success

#### Scenario: Reporting Deno installer availability

- **GIVEN** the user runs `quantex capabilities` or `quantex doctor`
- **WHEN** Quantex reports managed installer availability
- **THEN** the output includes Deno availability alongside Bun, npm, Homebrew, Cargo, pip, uv, and winget

#### Scenario: Schemas document Deno installer availability

- **GIVEN** the user runs `quantex schema capabilities` or `quantex schema doctor` in JSON mode
- **WHEN** Quantex returns command `dataSchema`
- **THEN** the `installers` object lists the `deno` installer key that the corresponding command may emit
- **AND** strict schema validation of real JSON output does not fail solely because the Deno installer flag is missing from the published schema
