# Project Memory Specification Delta

## Modified Requirements

### Requirement: Agent-specific workflow files SHALL stay thin

The repository SHALL NOT maintain full copied OPSX workflow instructions separately for each supported coding agent. Agent-specific or common agent bootstrap directories MAY contain thin bootstrap files whose purpose is to route the agent to Superpowers, the central Quantex runtime skill, and repo-native OpenSpec artifacts.

#### Scenario: Maintainer updates Quantex workflow rules

- **WHEN** Quantex workflow rules change
- **THEN** the maintainer updates the central runtime skill, OpenSpec specs, or canonical docs
- **AND** agent-specific or common bootstrap files remain short pointers rather than full duplicate workflow copies

#### Scenario: Agent uses the common bootstrap entry point

- **WHEN** a compatible coding-agent runtime discovers `.agents/skills/quantex-agent-runtime/SKILL.md`
- **THEN** the bootstrap routes the session to `skills/quantex-agent-runtime/SKILL.md`, `AGENTS.md`, and `openspec/README.md`
- **AND** it does not duplicate the full contributor workflow body
