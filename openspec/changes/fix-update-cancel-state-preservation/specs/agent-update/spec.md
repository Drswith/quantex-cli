## MODIFIED Requirements

### Requirement: Managed lifecycle cancellation MUST terminate Windows wrapper process trees before wrapper fallback kill

When Quantex cancels a managed lifecycle installer on Windows and a child process identifier is available, it SHALL attempt process-tree termination before directly killing the wrapper process. Quantex MUST preserve sticky cancellation semantics if process-tree termination is unavailable, denied, or races with child exit.

#### Scenario: Cancellation is observed after installed-agent state persistence completes

- **GIVEN** a managed install or adopt/track persistence call has completed `setInstalledAgentState()`
- **AND** the CLI context is cancelled before the persistence helper returns to its caller
- **WHEN** Quantex finalizes the lifecycle operation
- **THEN** Quantex removes the just-written installed-agent state for that agent
- **AND** managed install callers roll back the managed install when rollback is available
- **AND** the operation reports failure to callers instead of success

#### Scenario: Managed update cancellation preserves recorded install state

- **GIVEN** a managed update subprocess has exited successfully for a tracked agent
- **AND** Quantex has marked the CLI context as cancelled before update state persistence returns
- **WHEN** `updateAgent()` finalizes the lifecycle operation
- **THEN** Quantex does not remove the agent's recorded installed-agent state
- **AND** the operation reports update failure to callers instead of success
