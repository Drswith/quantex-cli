## MODIFIED Requirements

### Requirement: Managed lifecycle cancellation MUST terminate Windows wrapper process trees before wrapper fallback kill

When Quantex cancels a managed lifecycle installer on Windows and a child process identifier is available, it SHALL attempt process-tree termination before directly killing the wrapper process. Quantex MUST preserve sticky cancellation semantics if process-tree termination is unavailable, denied, or races with child exit.

#### Scenario: Windows wrapper child owns a long-running installer descendant

- **GIVEN** Quantex is running a managed installer through a Windows wrapper process
- **AND** the wrapper has started a long-running installer descendant
- **WHEN** the managed installer operation is cancelled by signal or timeout
- **THEN** Quantex attempts process-tree termination for the wrapper process identifier before direct wrapper termination
- **AND** the installer descendant does not continue producing installer progress after Quantex returns the cancelled result
- **AND** Quantex does not persist normal installed-agent state for the cancelled operation

#### Scenario: Batch install does not continue after timeout cancellation

- **GIVEN** the user runs `quantex install <slow-agent> <fast-agent> --timeout <duration>`
- **AND** the first agent's install work exceeds the configured timeout and late-completion grace window
- **WHEN** Quantex emits a timeout cancellation result for the command
- **THEN** it does not install or persist state for `<fast-agent>`
- **AND** it does not persist normal installed-agent state for the cancelled `<slow-agent>` operation

#### Scenario: Batch update does not continue after timeout cancellation

- **GIVEN** the user runs `quantex update --all --timeout <duration>`
- **AND** an early update item exceeds the configured timeout and late-completion grace window
- **WHEN** Quantex emits a timeout cancellation result for the command
- **THEN** it does not perform later update work for remaining agents in the same command
- **AND** it does not persist normal installed-agent state for the cancelled update operation

#### Scenario: Cancelled managed install does not fall through to later install methods

- **GIVEN** an agent definition lists multiple managed install methods in priority order
- **AND** the first managed install subprocess exits successfully on disk
- **AND** the CLI context is cancelled before Quantex records the install as successful
- **WHEN** Quantex evaluates the first managed install attempt
- **THEN** it rolls back packages installed by that attempt when rollback is supported
- **AND** it does not run later install methods for the same agent in the same command
- **AND** it does not persist normal installed-agent state for the cancelled operation
