## ADDED Requirements

### Requirement: Superpowers SHALL provide the cross-agent session runtime

Quantex SHALL use Superpowers as the preferred cross-agent runtime for coding-agent session startup, planning, implementation discipline, verification, and delivery closure. OpenSpec SHALL remain the source of truth for non-trivial change contracts and accepted project-memory state.

#### Scenario: Agent starts a Quantex session with Superpowers available

- **WHEN** a coding agent starts a new Quantex repository session
- **AND** Superpowers is available in that agent environment
- **THEN** the agent MUST activate Superpowers before planning or editing
- **AND** it MUST use the central Quantex agent runtime skill for repository-specific intake, validation, artifact routing, and closure rules

#### Scenario: Agent starts without Superpowers available

- **WHEN** a coding agent starts a Quantex repository session
- **AND** Superpowers is not available in that agent environment
- **THEN** the agent MUST follow the bootstrap fallback in `AGENTS.md`
- **AND** it MUST still use OpenSpec and repository validation commands as the source-of-truth workflow

### Requirement: Agent-specific workflow files SHALL stay thin

The repository SHALL NOT maintain full copied OPSX workflow instructions separately for each supported coding agent. Agent-specific directories MAY contain thin bootstrap files whose purpose is to route the agent to Superpowers, the central Quantex runtime skill, and repo-native OpenSpec artifacts.

#### Scenario: Maintainer updates Quantex workflow rules

- **WHEN** Quantex workflow rules change
- **THEN** the maintainer updates the central runtime skill, OpenSpec specs, or canonical docs
- **AND** agent-specific bootstrap files remain short pointers rather than full duplicate workflow copies

## MODIFIED Requirements

### Requirement: OPSX actions MUST be available across supported coding agents

The project SHALL make OpenSpec actions available across supported coding agents through the Superpowers-backed Quantex agent runtime. The runtime SHALL instruct agents to use official OpenSpec CLI commands such as `openspec status`, `openspec instructions`, `openspec validate`, and `openspec archive` instead of relying on copied per-agent OPSX command bodies.

#### Scenario: Agent starts a non-trivial change

- GIVEN a supported coding agent is asked to plan a non-trivial behavior or durable-process change
- WHEN the agent needs workflow guidance
- THEN it can use the Superpowers-backed Quantex runtime to choose explore, propose, apply, and archive behavior
- AND shared project-specific guidance comes from the central runtime skill, `openspec/config.yaml`, and current OpenSpec artifacts

### Requirement: Completed OpenSpec changes MUST reach archive closure

When a non-trivial change is tracked in OpenSpec, the project SHALL treat implementation merge and archive closure as separate lifecycle moments, and SHALL close the change by archiving it after its accepted spec delta is synced. Archive closure SHALL be owned by the agent-driven delivery workflow instead of repository automation that automatically opens and merges archive PRs.

#### Scenario: Completed change lands on a protected branch

- **WHEN** an OpenSpec-backed implementation PR merges to a protected branch such as `main` or `beta`
- **THEN** the project keeps the merged code as implemented work
- **AND** an agent using the Quantex runtime follows up by syncing accepted spec deltas and archiving the completed change
- **AND** the agent reports whether archive closure is complete or still pending

#### Scenario: Agent performs archive follow-up

- **WHEN** an agent resumes archive closure for a completed OpenSpec change
- **THEN** it MUST run the relevant OpenSpec status and archive commands
- **AND** it MUST run `bun run openspec:validate`
- **AND** it MUST deliver the archive change through the normal commit, push, and PR path when protected branches prevent direct closure
