## MODIFIED Requirements

### Requirement: Completed OpenSpec changes MUST reach archive closure

When a non-trivial change is tracked in OpenSpec, the project SHALL treat implementation merge and archive closure as separate lifecycle moments, and SHALL close the change by archiving it after its accepted spec delta is synced. Archive closure SHALL be owned by the agent-driven delivery workflow instead of repository automation that automatically opens and merges archive PRs.

#### Scenario: Completed change lands on the protected main branch

- **WHEN** an OpenSpec-backed implementation PR merges to the protected `main` branch
- **THEN** the project keeps the merged code as implemented work
- **AND** an agent using the Quantex runtime follows up by syncing accepted spec deltas and archiving the completed change
- **AND** the agent reports whether archive closure is complete or still pending

#### Scenario: Agent performs archive follow-up

- **WHEN** an agent resumes archive closure for a completed OpenSpec change
- **THEN** it MUST run the relevant OpenSpec status and archive commands
- **AND** it MUST run `bun run openspec:validate`
- **AND** it MUST deliver the archive change through the normal commit, push, and PR path when protected branches prevent direct closure
