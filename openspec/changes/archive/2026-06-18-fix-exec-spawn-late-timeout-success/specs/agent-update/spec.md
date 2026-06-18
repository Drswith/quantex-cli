## MODIFIED Requirements

### Requirement: Exec and shortcut spawn flows MUST honor global timeout during agent execution

When `quantex exec` or shortcut `quantex <agent>` runs with `--timeout` and launches an installed agent binary, Quantex SHALL apply the configured timeout to the spawned agent process. After the deadline fires, Quantex SHALL wait up to `min(timeoutMs, 250)` for the process to exit before cancelling it.

#### Scenario: Spawned agent exceeds timeout and grace window

- **GIVEN** the target agent is installed
- **AND** the user runs `quantex exec <agent> --timeout <duration>` or shortcut `quantex <agent> --timeout <duration>`
- **WHEN** the spawned agent process does not exit within the configured timeout and late-completion grace window
- **THEN** Quantex cancels the spawned agent process
- **AND** it returns a timeout result with exit code `10`

#### Scenario: Successful spawn exit after timeout deadline returns agent exit code

- **GIVEN** the target agent is installed
- **AND** the user runs `quantex exec <agent> --timeout <duration>` or shortcut `quantex <agent> --timeout <duration>`
- **WHEN** the spawned agent process exits successfully within the late-completion grace window after the timeout deadline fired
- **THEN** Quantex returns the agent process exit code
- **AND** it does not cancel the spawned agent process before the grace window ends
