## ADDED Requirements

### Requirement: Managed package versions MUST drive managed update comparisons when available

For agents with recorded managed install state and a known package name, Quantex SHALL inspect the installed managed package version and use it as the installed version for update planning when that package version is available.

#### Scenario: Repeated Bun-managed batch update reports up to date

- **GIVEN** an agent is recorded as installed through Bun with package name `@example/agent`
- **AND** the installed Bun global package version is `2.0.0`
- **AND** the latest package version is `2.0.0`
- **WHEN** the user runs `quantex update --all`
- **THEN** Quantex reports the agent as up to date
- **AND** it does not execute a managed Bun update for that agent

#### Scenario: Managed package version falls back to binary probing when unavailable

- **GIVEN** an agent is recorded as installed through a managed package source
- **AND** Quantex cannot determine the installed managed package version
- **WHEN** Quantex inspects the agent for an update
- **THEN** Quantex falls back to the agent binary version probe

### Requirement: Agent lifecycle locks MUST recover from stale owners

Quantex SHALL prevent concurrent agent lifecycle operations with a resource lock, and it MUST recover a lock left behind by an owner process that is no longer running.

#### Scenario: Recovering a stale lifecycle lock

- **GIVEN** an agent lifecycle lock exists
- **AND** the lock owner process is no longer running
- **WHEN** a later agent lifecycle command acquires the same lock
- **THEN** Quantex removes the stale lock
- **AND** the later command can continue

#### Scenario: Preserving a live lifecycle lock

- **GIVEN** an agent lifecycle lock exists
- **AND** the lock owner process is still running
- **WHEN** another agent lifecycle command tries to acquire the same lock
- **THEN** Quantex reports a lock conflict
- **AND** it does not remove the live lock
