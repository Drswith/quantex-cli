## ADDED Requirements

### Requirement: Self-update completion MUST NOT require a stable executable path

An agent whose self-update command installs each release into its own directory relocates its executable on every successful upgrade. Quantex MUST verify such an update through the recorded provider binding and semantic version ordering, and MUST NOT report a postcondition failure solely because the post-update executable path differs from the path recorded by the pre-update lifecycle receipt. On success Quantex MUST persist a refreshed receipt carrying the observed post-update executable path and version.

#### Scenario: Self-update relocates the executable to a new versioned directory

- **GIVEN** a tracked unmanaged agent whose lifecycle receipt records an executable path under its previous release directory
- **AND** the agent's self-update command exits successfully and installs a newer version into a new release directory
- **WHEN** Quantex verifies the update
- **THEN** Quantex reports the agent as updated
- **AND** it persists a lifecycle receipt containing the new executable path and the newly observed version

#### Scenario: Stale recorded path does not block a later update

- **GIVEN** a tracked unmanaged agent whose lifecycle receipt records an executable path and version from an earlier release
- **AND** live observation reports a different executable path at a semantically newer version
- **WHEN** the user runs `quantex update <agent>` or `quantex update --all`
- **THEN** Quantex does not block the update as an unsafe source
- **AND** it plans the recorded self-update strategy for the agent

#### Scenario: Self-update on an already current agent refreshes stale receipt evidence

- **GIVEN** a tracked unmanaged agent whose lifecycle receipt records an outdated executable path and version
- **AND** the self-update command exits successfully without changing the installed version
- **WHEN** Quantex verifies the update
- **THEN** Quantex reports the agent as up to date
- **AND** it persists a lifecycle receipt containing the currently observed executable path and version

### Requirement: Update failure output MUST expose the blocking reason

When `quantex update` reports an agent as failed, human-mode output MUST include the typed reason already carried in the structured result's `message` field, on the same single failure line style as the rest of the update report. Quantex MUST NOT replace an available reason with only the fixed `Failed to update <agent>.` line, and MUST NOT branch reconciliation behavior on that reason's text.

#### Scenario: Blocked update reports why it was blocked

- **GIVEN** update planning blocks an agent because its recorded source and live evidence do not establish a safe automatic update path
- **WHEN** Quantex renders human-mode output
- **THEN** the failure output includes the blocking reason
- **AND** the structured result continues to carry the same reason in `data.results[].message`

#### Scenario: Failure without a reason keeps the existing line

- **GIVEN** an agent update fails through an outcome that carries no reason
- **WHEN** Quantex renders human-mode output
- **THEN** the failure output is the existing `Failed to update <agent>.` line
- **AND** no empty or placeholder reason is printed
