## MODIFIED Requirements

### Requirement: Single-agent update MUST choose an appropriate strategy

The agent update system SHALL choose the best available update strategy for a single agent based on install source and agent capabilities.

#### Scenario: Updating a managed agent

- GIVEN an agent was installed through a managed package source
- WHEN the user runs `quantex update <agent>`
- THEN Quantex selects the matching managed update path

#### Scenario: Updating an agent that cannot be managed automatically

- GIVEN an installed agent is not updateable through a managed path
- WHEN the user runs `quantex update <agent>`
- THEN Quantex provides a manual or explanatory hint instead of pretending the agent was upgraded

#### Scenario: Self-update only reports an upgrade when the installed version changes

- GIVEN an installed agent is updated through a self-update command
- AND Quantex can probe the installed version before and after the command
- WHEN the self-update command exits successfully
- THEN Quantex compares the probed versions
- AND reports the agent as updated only if the installed version changed

#### Scenario: Self-update reports no change when the version stays the same

- GIVEN an installed agent is updated through a self-update command
- AND Quantex can probe the installed version before and after the command
- WHEN the self-update command exits successfully
- BUT the installed version remains the same
- THEN Quantex reports the agent as up to date instead of updated
