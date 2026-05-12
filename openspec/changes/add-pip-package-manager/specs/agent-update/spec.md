## ADDED Requirements

### Requirement: pip-managed agent lifecycle MUST use pip commands

pip-managed agent lifecycle operations SHALL install, update, batch update, uninstall, and diagnose agents through the pip installer when the recorded or selected install source is pip.

#### Scenario: Updating pip-managed agents

- **GIVEN** an agent has recorded install state with install type `pip`
- **WHEN** the user runs `quantex update <agent>` or `quantex update --all`
- **THEN** Quantex selects the pip managed update path
- **AND** it runs pip with the recorded package name and `--upgrade` flag instead of guessing another package-manager source

#### Scenario: Grouping pip-managed updates

- **GIVEN** multiple installed agents have recorded pip install state
- **WHEN** the user runs `quantex update --all`
- **THEN** Quantex groups those updates by the pip installer
- **AND** it executes pip-managed batch update work without mixing the packages into npm, Bun, Homebrew, Cargo, or winget groups

#### Scenario: Reporting pip installer availability

- **GIVEN** the user runs `quantex capabilities` or `quantex doctor`
- **WHEN** Quantex reports managed installer availability
- **THEN** the output includes pip availability alongside Bun, npm, Homebrew, Cargo, and winget
