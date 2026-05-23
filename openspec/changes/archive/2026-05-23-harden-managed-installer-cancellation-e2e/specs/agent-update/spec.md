## ADDED Requirements

### Requirement: Managed lifecycle cancellation MUST terminate Windows wrapper process trees before wrapper fallback kill

When Quantex cancels a managed lifecycle installer on Windows and a child process identifier is available, it SHALL attempt process-tree termination before directly killing the wrapper process. Quantex MUST preserve sticky cancellation semantics if process-tree termination is unavailable, denied, or races with child exit.

#### Scenario: Windows wrapper child owns a long-running installer descendant

- **GIVEN** Quantex is running a managed installer through a Windows wrapper process
- **AND** the wrapper has started a long-running installer descendant
- **WHEN** the managed installer operation is cancelled by signal or timeout
- **THEN** Quantex attempts process-tree termination for the wrapper process identifier before direct wrapper termination
- **AND** the installer descendant does not continue producing installer progress after Quantex returns the cancelled result
- **AND** Quantex does not persist normal installed-agent state for the cancelled operation
