## MODIFIED Requirements

### Requirement: Uninstall MUST clear tracked unmanaged install state

When an agent is recorded with install type `script` or `binary`, Quantex SHALL remove the installed-agent state entry on uninstall even though no managed package uninstall command exists. Command-level uninstall postconditions MUST NOT override that state-only outcome by requiring provider absence or `PATH` executable absence for these install types.

#### Scenario: Uninstalling a tracked script install

- **GIVEN** an agent has recorded install state with install type `script`
- **AND** the agent executable may still be present in `PATH`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex removes the installed-agent state entry
- **AND** the uninstall command reports success
- **AND** Quantex does not require a managed package-manager uninstall for that install type
- **AND** Quantex does not fail verification solely because the executable remains on `PATH`

#### Scenario: Uninstalling a tracked binary install

- **GIVEN** an agent has recorded install state with install type `binary`
- **AND** the agent executable may still be present in `PATH`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex removes the installed-agent state entry
- **AND** the uninstall command reports success
- **AND** Quantex does not fail verification solely because the executable remains on `PATH`
