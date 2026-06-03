## ADDED Requirements

### Requirement: Uninstall MUST clear tracked unmanaged install state

When an agent is recorded with install type `script` or `binary`, Quantex SHALL remove the installed-agent state entry on uninstall even though no managed package uninstall command exists.

#### Scenario: Uninstalling a tracked script install

- **GIVEN** an agent has recorded install state with install type `script`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex removes the installed-agent state entry
- **AND** the uninstall command reports success
- **AND** Quantex does not require a managed package-manager uninstall for that install type

#### Scenario: Uninstalling a tracked binary install

- **GIVEN** an agent has recorded install state with install type `binary`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex removes the installed-agent state entry
- **AND** the uninstall command reports success
