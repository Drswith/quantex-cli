# project-memory Spec Delta

## MODIFIED Requirements

### Requirement: Agent-specific workflow files SHALL stay thin

The repository SHALL NOT maintain full copied OPSX workflow instructions separately for each supported coding agent. The repository also SHALL NOT treat checked-in agent-specific skill mirrors as canonical workflow contracts. Agent-specific integration files MAY exist only when they are necessary for a supported environment and SHALL remain short routes to Superpowers, the central Quantex runtime skill, and repo-native OpenSpec artifacts.

#### Scenario: Maintainer updates Quantex workflow rules

- **WHEN** Quantex workflow rules change
- **THEN** the maintainer updates the central runtime skill, OpenSpec specs, or canonical docs
- **AND** agent-specific integration files remain short pointers rather than full duplicate workflow copies
- **AND** checked-in per-agent skill mirrors are not required for Claude, Cursor, Gemini, OpenCode, or comparable agents when the central text-first runtime entry remains available

#### Scenario: Agent-specific generated environment metadata exists

- **WHEN** the repository includes environment setup metadata for a specific hosted agent integration
- **THEN** that metadata may describe setup commands or provisioning details
- **AND** it does not become the source of truth for durable Quantex workflow policy
