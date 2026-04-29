## ADDED Requirements

### Requirement: Repository workflow scripts MUST remain guardrails instead of orchestration commands

Repository scripts that support the agent workflow SHALL remain focused on validation, classification, generation of build or release artifacts, and other executable guardrails. The project MUST NOT add repo-local workflow wrapper commands when Superpowers runtime instructions plus official CLIs such as `gh`, `git`, and `openspec` can perform the action with the same reviewability.

#### Scenario: A workflow gap is discovered

- **GIVEN** a recurring agent delivery failure is discovered
- **WHEN** a maintainer chooses how to fix it
- **THEN** the maintainer MUST prefer central runtime instructions, OpenSpec contracts, GitHub-native workflow enforcement, or a narrow validator over a new repo-local orchestration command

#### Scenario: Native tool plus validator is sufficient

- **GIVEN** an agent needs to create or edit a pull request
- **WHEN** the repository already exposes a local validator for the PR body
- **THEN** the project MUST keep the action on the native GitHub CLI
- **AND** it MUST NOT add a project-specific PR creation command solely to sequence that native action
