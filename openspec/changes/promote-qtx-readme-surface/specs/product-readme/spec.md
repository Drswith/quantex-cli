## ADDED Requirements

### Requirement: README Recommends The Preferred Short Entry Point

The product README SHALL present `qtx` as the recommended short command entry point for human-facing onboarding while explicitly identifying `quantex` as the equivalent long-form command.

#### Scenario: User scans the onboarding path

- **WHEN** a user reads the install, quick start, or supported-agent sections in `README.md` or `README.en.md`
- **THEN** the primary examples use `qtx` for the shortest copyable path
- **AND** the documentation states that `qtx` and `quantex` are equivalent entry points

### Requirement: README Documents Verified Read-Only No-Install Usage

The product README SHALL include a first-class no-install try-it-out section that promotes only read-only or discovery-oriented commands and uses command forms verified against the published package behavior.

#### Scenario: User evaluates Quantex without a global install

- **WHEN** a user opens the no-install try-it-out section
- **THEN** the README shows copyable commands for read-only surfaces such as `list`, `info`, `inspect`, `doctor`, `capabilities`, `commands`, or `schema`
- **AND** each recommended package-manager form matches a currently working invocation for the published package
- **AND** the section states any current runtime prerequisite needed to execute those commands

#### Scenario: User looks for mutating no-install commands

- **WHEN** a user reads the no-install try-it-out guidance
- **THEN** the README directs install, update, uninstall, and other state-writing flows back to the normal installation paths instead of promoting them as first-class no-install usage
