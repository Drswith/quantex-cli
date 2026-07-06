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

#### Scenario: Batch update reports failure when cancellation interrupts processing

- **GIVEN** the user runs `quantex update --all`
- **AND** Quantex begins updating tracked agents
- **WHEN** the CLI context becomes cancelled before every planned update entry is processed
- **THEN** Quantex does not report overall command success
- **AND** the command result uses a cancellation failure code
- **AND** any agents already updated remain listed in the partial `results` payload
