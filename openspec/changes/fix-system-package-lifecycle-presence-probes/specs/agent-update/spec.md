## MODIFIED Requirements

### Requirement: Uninstall MUST recover ghost managed install state

When a managed package is no longer installed but Quantex still records install state, uninstall SHALL clear the stale state entry after confirming package absence through the recorded installer.

#### Scenario: Ghost recovery does not run when npm presence probing is inconclusive

- **GIVEN** an agent has recorded managed install state with install type `npm`
- **AND** npm is available
- **AND** npm global presence probing cannot confirm whether the package is installed or absent
- **WHEN** the user runs `quantex uninstall <agent>`
- **AND** the managed package-manager uninstall command reports failure
- **THEN** Quantex does not remove the installed-agent state entry
- **AND** the uninstall command reports failure

#### Scenario: Ghost recovery does not run when bun presence probing is inconclusive

- **GIVEN** an agent has recorded managed install state with install type `bun`
- **AND** bun is available
- **AND** bun global presence probing cannot confirm whether the package is installed or absent
- **WHEN** the user runs `quantex uninstall <agent>`
- **AND** the managed package-manager uninstall command reports failure
- **THEN** Quantex does not remove the installed-agent state entry
- **AND** the uninstall command reports failure

#### Scenario: Ghost recovery does not run when mise presence probing is inconclusive

- **GIVEN** an agent has recorded managed install state with install type `mise`
- **AND** mise is available
- **AND** mise presence probing cannot confirm whether the package is installed or absent
- **WHEN** the user runs `quantex uninstall <agent>`
- **AND** the managed package-manager uninstall command reports failure
- **THEN** Quantex does not remove the installed-agent state entry
- **AND** the uninstall command reports failure

#### Scenario: Ghost recovery does not run when uv presence probing is inconclusive

- **GIVEN** an agent has recorded managed install state with install type `uv`
- **AND** uv is available
- **AND** uv tool presence probing cannot confirm whether the package is installed or absent
- **WHEN** the user runs `quantex uninstall <agent>`
- **AND** the managed package-manager uninstall command reports failure
- **THEN** Quantex does not remove the installed-agent state entry
- **AND** the uninstall command reports failure

#### Scenario: Ghost recovery does not run when cargo presence probing is inconclusive

- **GIVEN** an agent has recorded managed install state with install type `cargo`
- **AND** cargo is available
- **AND** cargo presence probing cannot confirm whether the package is installed or absent
- **WHEN** the user runs `quantex uninstall <agent>`
- **AND** the managed package-manager uninstall command reports failure
- **THEN** Quantex does not remove the installed-agent state entry
- **AND** the uninstall command reports failure

#### Scenario: Ghost recovery does not run when deno presence probing is inconclusive

- **GIVEN** an agent has recorded managed install state with install type `deno`
- **AND** deno is available
- **AND** deno presence probing cannot confirm whether the global binary is installed or absent
- **WHEN** the user runs `quantex uninstall <agent>`
- **AND** the managed package-manager uninstall command reports failure
- **THEN** Quantex does not remove the installed-agent state entry
- **AND** the uninstall command reports failure

#### Scenario: Ghost recovery does not run when pip presence probing is inconclusive

- **GIVEN** an agent has recorded managed install state with install type `pip`
- **AND** pip is available
- **AND** pip presence probing cannot confirm whether the package is installed or absent
- **WHEN** the user runs `quantex uninstall <agent>`
- **AND** the managed package-manager uninstall command reports failure
- **THEN** Quantex does not remove the installed-agent state entry
- **AND** the uninstall command reports failure

#### Scenario: Ghost recovery does not run when winget presence probing is inconclusive

- **GIVEN** an agent has recorded managed install state with install type `winget`
- **AND** winget is available
- **AND** winget presence probing cannot confirm whether the package is installed or absent
- **WHEN** the user runs `quantex uninstall <agent>`
- **AND** the managed package-manager uninstall command reports failure
- **THEN** Quantex does not remove the installed-agent state entry
- **AND** the uninstall command reports failure
