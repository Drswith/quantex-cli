## ADDED Requirements

### Requirement: Windows delayed replacement helper MUST be parseable PowerShell

The Windows standalone binary self-upgrade helper SHALL be scheduled as complete PowerShell statements that remain valid after process-argument encoding. A statement terminator MUST NOT appear between a `try` block and its matching `catch`. Quantex MAY still report success when that helper is scheduled, because the swap completes after the CLI process exits, but the scheduled command MUST be a script Windows PowerShell can parse and run.

#### Scenario: Scheduled helper keeps try/catch intact

- GIVEN Quantex is performing standalone binary self-upgrade on Windows
- WHEN it schedules delayed replacement
- THEN the helper script keeps each `try` block adjacent to its `catch` without a statement terminator between them
- AND the helper is passed to PowerShell in a form that preserves those line breaks

#### Scenario: Semicolon-joined helper lines are not scheduled

- GIVEN the historical Windows helper joined script lines with `; `
- WHEN Quantex schedules delayed replacement
- THEN it does not emit that semicolon-joined `-Command` form
- AND a `try` block is not separated from its `catch` by `;`
