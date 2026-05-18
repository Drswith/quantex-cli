## ADDED Requirements

### Requirement: Cargo-managed agent lifecycle MUST use Cargo commands

Cargo-managed agent lifecycle operations SHALL install, update, batch update, uninstall, and diagnose agents through the Cargo installer when the recorded or selected install source is Cargo.

#### Scenario: Updating Cargo-managed agents

- **GIVEN** an agent has recorded install state with install type `cargo`
- **WHEN** the user runs `quantex update <agent>` or `quantex update --all`
- **THEN** Quantex selects the Cargo managed update path
- **AND** it runs Cargo with the recorded crate name and `--force` instead of guessing another package-manager source
- **AND** it preserves any recorded Cargo install arguments such as `--locked`

#### Scenario: Grouping Cargo-managed updates

- **GIVEN** multiple installed agents have recorded Cargo install state
- **WHEN** the user runs `quantex update --all`
- **THEN** Quantex groups those updates by the Cargo installer
- **AND** it executes Cargo-managed batch update work without mixing the crates into npm, Bun, Homebrew, or winget groups

#### Scenario: Reporting Cargo installer availability

- **GIVEN** the user runs `quantex capabilities` or `quantex doctor`
- **WHEN** Quantex reports managed installer availability
- **THEN** the output includes Cargo availability alongside Bun, npm, Homebrew, and winget
