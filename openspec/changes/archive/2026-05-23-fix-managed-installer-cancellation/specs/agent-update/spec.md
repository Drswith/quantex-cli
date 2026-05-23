## ADDED Requirements

### Requirement: Managed lifecycle cancellation MUST be sticky

When Quantex cancels a managed lifecycle installer because of a signal or timeout, it SHALL treat that cancellation as sticky for the in-flight installer operation. Quantex MUST NOT persist installed-agent state, remove installed-agent state, or render a normal successful install, update, batch update, or uninstall result solely because the managed child process later exits successfully after cancellation was requested.

#### Scenario: Cancelled managed install exits successfully later

- **GIVEN** Quantex is running a managed installer for `quantex install <agent>`
- **AND** the user sends a cancellation signal or the command timeout expires
- **WHEN** the managed installer later exits with status `0`
- **THEN** Quantex treats the installer attempt as cancelled or failed rather than successful
- **AND** it does not persist the normal installed-agent state for that cancelled attempt
- **AND** it does not render the normal installed-success message

#### Scenario: Cancelled managed child process cleanup

- **GIVEN** Quantex is running a managed installer child process with inherited or piped stdio
- **WHEN** the CLI receives a cancellation signal or command timeout
- **THEN** Quantex requests termination of the managed child process
- **AND** on Windows it attempts process-tree termination when the child process identifier is available
- **AND** Quantex waits for a bounded cleanup window before returning the final cancelled result
