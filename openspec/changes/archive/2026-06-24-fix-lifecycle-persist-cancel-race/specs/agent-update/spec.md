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

#### Scenario: Managed subprocess succeeds but cancellation fires before state persistence completes

- **GIVEN** a managed install subprocess has exited successfully
- **AND** Quantex has marked the CLI context as cancelled because the timeout grace window expired
- **WHEN** `installAgent()` reaches installed-agent state persistence
- **THEN** Quantex skips writing normal installed-agent state for that operation
- **AND** Quantex rolls back the managed install when rollback is available
- **AND** the operation reports install failure to callers

#### Scenario: Cancellation is observed after installed-agent state persistence completes

- **GIVEN** a managed install or adopt/track persistence call has completed `setInstalledAgentState()`
- **AND** the CLI context is cancelled before the persistence helper returns to its caller
- **WHEN** Quantex finalizes the lifecycle operation
- **THEN** Quantex removes the just-written installed-agent state for that agent
- **AND** managed install callers roll back the managed install when rollback is available
- **AND** the operation reports failure to callers instead of success
