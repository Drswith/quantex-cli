## ADDED Requirements

### Requirement: A missing provider executable is unavailable, not inconclusive presence

When a catalog package-provider probe cannot start because the provider executable is missing from the environment (spawn `ENOENT` or `ENOTDIR`), Quantex MUST classify that outcome as provider-unavailable. Quantex MUST NOT treat that missing executable as inconclusive package presence, and MUST NOT fail-close install decide solely because an unused alternative provider is not installed.

An available provider whose probe runs but cannot classify the package as present or absent MUST remain inconclusive. Cancelled and timed-out probes MUST remain interruptions.

#### Scenario: npm spawn ENOENT does not fail-close install decide

- **GIVEN** the preferred catalog provider is bun and conclusively reports the package absent
- **AND** npm is not installed, so the npm presence probe fails to spawn with `ENOENT`
- **AND** no other exact catalog provider reports the package present
- **AND** no lifecycle receipt or installed-agent state exists for the agent
- **WHEN** Quantex observes the agent for install decide
- **THEN** the npm outcome is provider-unavailable rather than indeterminate presence
- **AND** install decide is `install`
- **AND** the command does not report that it could not determine the installed state because npm could not determine package presence

#### Scenario: An available npm with an inconclusive probe still fails closed when PATH is present

- **GIVEN** the preferred catalog provider is bun and conclusively reports the package absent
- **AND** npm is available
- **AND** the npm presence probe is inconclusive
- **AND** a live executable is present on `PATH`
- **AND** no lifecycle receipt or installed-agent state exists for the agent
- **WHEN** Quantex observes the agent for install decide
- **THEN** observation remains indeterminate
- **AND** install decide stays blocked as an undetermined decision

### Requirement: A leftover Bun global-bin executable is not live ownership after conclusive bun absence

When bun conclusively reports the catalog package absent, no exact catalog provider reports the package present, and every remaining exact-provider outcome is either conclusive absence or provider-unavailable, a `PATH` hit whose path identifies Bun's global bin (`/.bun/bin/` after separator normalization) MUST NOT be treated as live provider ownership. Install observation MUST report the agent absent so decide can select `install`. Quantex MUST still record the leftover path on `pathExecutable` and MUST NOT classify a `PATH` hit outside Bun's global bin as absent solely because bun is absent.

#### Scenario: Residual bun shim plus missing npm is installable

- **GIVEN** bun conclusively reports the package absent
- **AND** npm is unavailable
- **AND** a live executable resolves under Bun's global bin
- **AND** no lifecycle receipt or installed-agent state exists for the agent
- **WHEN** Quantex observes the agent for install decide
- **THEN** observation kind is absent
- **AND** `pathExecutable` remains present at that leftover path
- **AND** install decide is `install`

#### Scenario: Residual bun shim plus conclusive npm absence is installable

- **GIVEN** bun conclusively reports the package absent
- **AND** npm conclusively reports the package absent
- **AND** a live executable resolves under Bun's global bin
- **AND** no lifecycle receipt or installed-agent state exists for the agent
- **WHEN** Quantex observes the agent for install decide
- **THEN** observation kind is absent
- **AND** install decide is `install`

#### Scenario: A PATH copy outside Bun's global bin stays untracked

- **GIVEN** bun conclusively reports the package absent
- **AND** every other exact catalog provider is unavailable or conclusively absent
- **AND** a live executable resolves outside Bun's global bin
- **AND** no lifecycle receipt or installed-agent state exists for the agent
- **WHEN** Quantex observes the agent for install decide
- **THEN** observation is present with untracked drift
- **AND** install decide preserves the external copy
