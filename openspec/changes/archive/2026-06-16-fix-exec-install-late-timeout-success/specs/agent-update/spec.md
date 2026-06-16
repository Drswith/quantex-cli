## MODIFIED Requirements

### Requirement: Exec and shortcut install flows MUST honor global timeout during managed install

When `quantex exec` or shortcut `quantex <agent>` runs with `--timeout` and must install a missing agent before launch, Quantex SHALL apply the configured timeout to the install phase and SHALL cancel managed installer subprocesses when the deadline expires.

#### Scenario: Missing agent install times out before spawn

- **GIVEN** the target agent is not currently installed
- **AND** the user runs `quantex exec <agent> --install if-missing --timeout <duration>` or shortcut `quantex <agent> --timeout <duration>`
- **WHEN** managed install work exceeds the configured timeout
- **THEN** Quantex cancels the managed installer subprocesses
- **AND** it returns a timeout result with exit code `10`
- **AND** it does not continue to spawn the agent binary after the install deadline expires

#### Scenario: Successful install after timeout deadline is reported as success

- **GIVEN** the target agent is not currently installed
- **AND** the user runs `quantex exec <agent> --install if-missing --timeout <duration>` or shortcut `quantex <agent> --timeout <duration>`
- **WHEN** managed install work completes successfully shortly after the timeout deadline fired
- **THEN** Quantex reports install success
- **AND** it continues to spawn the agent binary when launch is requested
