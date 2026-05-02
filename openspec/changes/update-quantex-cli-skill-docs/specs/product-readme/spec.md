## ADDED Requirements

### Requirement: README Distinguishes User Skill From Contributor Runtime

The product README SHALL distinguish the user-facing Quantex CLI skill from the contributor-facing Quantex agent runtime skill.

#### Scenario: User installs a Quantex skill from README

- **WHEN** a user reads the agent quick start or skill installation guidance
- **THEN** the normal skill installation path points to `skills/quantex-cli`
- **AND** the documentation does not present `skills/quantex-agent-runtime` as a general user-facing skill

#### Scenario: Contributor starts repository work

- **WHEN** a contributor or coding agent is working inside this repository
- **THEN** the repository workflow guidance may direct them to `skills/quantex-agent-runtime`
- **AND** the guidance identifies it as repository development runtime rather than the public Quantex operation skill
