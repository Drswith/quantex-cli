## ADDED Requirements

### Requirement: Quantex Runtime Skill Is Contributor-Facing

The central Quantex agent runtime skill SHALL be treated as a repository development workflow artifact for contributors and coding agents working inside this repository, not as the normal user-facing skill for operating Quantex.

#### Scenario: Maintainer documents repo-local skills

- **WHEN** repo-local skills are described in project memory or distribution docs
- **THEN** `skills/quantex-cli` is identified as the user/agent-facing Quantex operation skill
- **AND** `skills/quantex-agent-runtime` is identified as contributor-facing repository workflow runtime

#### Scenario: User follows normal Quantex skill installation

- **WHEN** a user wants a skill for operating Quantex from an external agent runtime
- **THEN** the documented default target is `quantex-cli`
- **AND** the user is not instructed to install `quantex-agent-runtime` unless they are contributing to this repository
