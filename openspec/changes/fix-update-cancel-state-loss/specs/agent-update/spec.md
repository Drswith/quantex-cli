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

#### Scenario: Cancelled managed update preserves recorded install state

- **GIVEN** an agent already has recorded managed install state
- **AND** a managed update command succeeds for that recorded install source
- **AND** the CLI context is cancelled before `updateAgent()` finishes re-persisting that recorded state
- **WHEN** Quantex finalizes the update operation
- **THEN** it does not remove the pre-existing installed-agent state entry
- **AND** the update reports failure to callers instead of success
