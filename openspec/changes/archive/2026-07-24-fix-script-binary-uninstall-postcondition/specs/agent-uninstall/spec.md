## ADDED Requirements

### Requirement: Tracked unmanaged uninstall MUST clear Quantex state without requiring executable removal

When an agent has recorded install state with install type `script` or `binary`, Quantex SHALL treat uninstall as state-only untracking. Quantex MUST remove the installed-agent state entry and any lifecycle receipt for that agent, report command success, and MUST NOT require the live executable to disappear from `PATH` or provider observation to become absent.

#### Scenario: Uninstall tracked script install while executable remains on PATH

- **GIVEN** an agent has recorded install state with install type `script`
- **AND** the agent executable is still present in `PATH`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex removes the installed-agent state entry
- **AND** Quantex removes any lifecycle receipt for that agent
- **AND** the uninstall command reports success
- **AND** Quantex does not require the executable to leave `PATH`
- **AND** Quantex does not claim managed package-manager removal for that install type

#### Scenario: Uninstall tracked binary install while executable remains on PATH

- **GIVEN** an agent has recorded install state with install type `binary`
- **AND** the agent executable is still present in `PATH`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex removes the installed-agent state entry
- **AND** Quantex removes any lifecycle receipt for that agent
- **AND** the uninstall command reports success
- **AND** Quantex does not require the executable to leave `PATH`

#### Scenario: Tracked unmanaged uninstall does not synthesize managed removal evidence

- **GIVEN** an agent has recorded install state with install type `script` or `binary`
- **AND** no lifecycle receipt exists for that agent
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex does not create a lifecycle receipt solely to verify provider removal
- **AND** after success, Quantex has neither installed-agent state nor a lifecycle receipt for that agent
