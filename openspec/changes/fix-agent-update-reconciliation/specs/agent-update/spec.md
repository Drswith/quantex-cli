## ADDED Requirements

### Requirement: Batch update eligibility MUST follow live and persisted installation evidence

`quantex update --all` MUST exclude a catalog entry when no executable, installed-agent state, or lifecycle receipt exists, even if a candidate provider is unavailable or cannot conclusively report package absence. A recorded-absent target MUST NOT be executed as an update or counted as an update failure.

#### Scenario: Never-installed agent has an unavailable candidate provider

- **GIVEN** an agent exists in the catalog
- **AND** its executable, installed-agent state, and lifecycle receipt are absent
- **AND** a candidate provider is unavailable or inconclusive
- **WHEN** the user runs `quantex update --all`
- **THEN** the agent is omitted from update results
- **AND** the batch is not failed because of that catalog entry

#### Scenario: Recorded agent is conclusively absent

- **GIVEN** an agent has persisted lifecycle evidence
- **AND** fresh observation conclusively reports the provider target and executable absent
- **WHEN** the user runs `quantex update --all`
- **THEN** Quantex does not execute an update for that agent
- **AND** it does not count the stale target as an update failure
- **AND** it emits reconciliation guidance without silently deleting the evidence

### Requirement: Lifecycle updates MUST execute declared self-update commands for tracked unmanaged sources

When an installed agent has recorded script or binary provenance and declares a self-update command, Quantex MUST execute that command instead of requiring the install-source provider to resolve a target version. Quantex MUST retain the recorded install provenance and verify the result from a fresh observation.

#### Scenario: Tracked script install supports self-update

- **GIVEN** an installed agent has recorded `script` install state
- **AND** its catalog definition declares a self-update command
- **WHEN** the user runs a single or batch update
- **THEN** Quantex executes the declared self-update command
- **AND** it does not invoke a candidate managed installer
- **AND** it does not rewrite the recorded script provenance

#### Scenario: Self-update changes the installed version

- **GIVEN** a tracked agent executes its self-update command successfully
- **AND** a fresh observation reports a newer comparable version with matching source evidence
- **WHEN** Quantex verifies the update
- **THEN** the result is `updated`

#### Scenario: Self-update leaves the installed version unchanged

- **GIVEN** a tracked agent executes its self-update command successfully
- **AND** fresh observation reports the same comparable version with matching source evidence
- **WHEN** Quantex verifies the update
- **THEN** the result is `up-to-date`

#### Scenario: Self-update cannot be verified

- **GIVEN** a self-update command exits successfully
- **AND** fresh observation cannot confirm a present executable, matching source, or comparable installed version
- **WHEN** Quantex verifies the update
- **THEN** it reports a verification failure
- **AND** it does not claim the agent was updated

### Requirement: Single and batch update projections MUST remain consistent

Equivalent lifecycle planning and execution outcomes MUST use the same update status and explanation in single-agent and batch update modes.

#### Scenario: Equivalent blocked outcome in both scopes

- **GIVEN** the same installed agent produces the same blocked lifecycle update outcome
- **WHEN** it is updated once by name and once through `--all`
- **THEN** both result items use the same status and explanation
- **AND** only genuine failed outcomes contribute to update failure exit semantics
