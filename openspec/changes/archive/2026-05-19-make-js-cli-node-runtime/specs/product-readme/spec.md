## MODIFIED Requirements

### Requirement: README Documents Verified Read-Only No-Install Usage

The product README SHALL include a first-class no-install try-it-out section that promotes only read-only or discovery-oriented commands and uses command forms verified against the published package behavior.

#### Scenario: User evaluates Quantex without a global install

- **WHEN** a user opens the no-install try-it-out section
- **THEN** the README shows copyable commands for read-only surfaces such as `list`, `info`, `inspect`, `doctor`, `capabilities`, `commands`, or `schema`
- **AND** each recommended package-manager form matches a currently working invocation for the published package
- **AND** the section states the current Node-based runtime prerequisite for managed package execution when applicable
- **AND** the section does not claim that `bun` is required merely to execute the published JS CLI

#### Scenario: User looks for mutating no-install commands

- **WHEN** a user reads the no-install try-it-out guidance
- **THEN** the README directs install, update, uninstall, and other state-writing flows back to the normal installation paths instead of promoting them as first-class no-install usage
