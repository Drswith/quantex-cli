## MODIFIED Requirements

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

#### Scenario: Public skill mirrors supported-agent names

- **WHEN** `skills/quantex-cli` includes a maintained supported-agent snapshot
- **THEN** that snapshot is checked against the live CLI catalog from `capabilities --json`
- **AND** known supported agents are not omitted from the skill-facing mirror
- **AND** the skill still identifies the running binary as the source of truth for current support, flags, and output shapes
