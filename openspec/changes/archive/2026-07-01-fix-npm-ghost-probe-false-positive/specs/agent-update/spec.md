## MODIFIED Requirements

### Requirement: Uninstall MUST recover ghost managed install state

When a managed package is no longer installed but Quantex still records install state, uninstall SHALL clear the stale state entry after confirming package absence through the recorded installer.

#### Scenario: Retrying uninstall after package removal succeeded but state persistence failed

- **GIVEN** an agent has recorded managed install state
- **AND** the managed package is no longer installed on the system
- **AND** the recorded package manager is available and can confirm absence
- **WHEN** the user runs `quantex uninstall <agent>`
- **AND** the managed package-manager uninstall command reports failure
- **THEN** Quantex removes the installed-agent state entry
- **AND** the uninstall command reports success

#### Scenario: Ghost recovery does not run when the package manager is unavailable

- **GIVEN** an agent has recorded managed install state
- **AND** the recorded package manager is unavailable
- **WHEN** the user runs `quantex uninstall <agent>`
- **AND** the managed package-manager uninstall command reports failure
- **THEN** Quantex does not remove the installed-agent state entry
- **AND** the uninstall command reports failure

#### Scenario: Ghost recovery does not run when npm presence probing is inconclusive

- **GIVEN** an agent has recorded managed install state with install type `npm`
- **AND** npm is available
- **AND** npm global presence probing cannot confirm whether the package is installed or absent
- **WHEN** the user runs `quantex uninstall <agent>`
- **AND** the managed package-manager uninstall command reports failure
- **THEN** Quantex does not remove the installed-agent state entry
- **AND** the uninstall command reports failure
