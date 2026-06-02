## MODIFIED Requirements

### Requirement: Single-agent update MUST choose an appropriate strategy

The agent update system SHALL choose the best available update strategy for a single agent based on the recorded install source and agent capabilities. When recorded install state exists, Quantex MUST NOT override that source by inferring a different managed installer from candidate install methods.

#### Scenario: Recorded managed install without a usable package name fails closed

- **GIVEN** an agent has recorded install state with a managed `installType`
- **AND** the recorded state does not include a non-empty `packageName`
- **AND** the agent catalog cannot infer a package name for that managed install type
- **WHEN** the user runs `quantex update <agent>`
- **THEN** Quantex does not run a self-update command as a substitute for the recorded managed source
- **AND** the update reports failure instead of success through an unrelated update path

#### Scenario: Managed install rolls back when state persistence fails

- **GIVEN** a managed install command succeeds for an agent
- **WHEN** Quantex cannot persist the installed-agent state immediately afterward
- **THEN** Quantex attempts to roll back the managed install
- **AND** the install operation surfaces the state persistence failure
