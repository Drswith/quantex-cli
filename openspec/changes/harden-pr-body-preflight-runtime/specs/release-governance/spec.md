## ADDED Requirements

### Requirement: PR body governance MUST be run before PR delivery actions

Agents and contributors SHALL run the local PR body governance command before creating a pull request or editing a pull request body when they provide a body manually. The repository SHALL prefer native GitHub CLI PR commands with a validated body file over repo-local commands that wrap PR creation.

#### Scenario: Agent creates a pull request

- **GIVEN** an agent has prepared a branch for PR delivery
- **WHEN** the agent writes the pull request body
- **THEN** it MUST write the body to a file based on `.github/pull_request_template.md`
- **AND** it MUST run `bun run pr:body:check -- --body-file <body-file> --title "<title>"` before `gh pr create --body-file <body-file>`

#### Scenario: Agent edits a pull request body

- **GIVEN** an agent needs to update an existing pull request body
- **WHEN** the agent prepares the replacement body manually
- **THEN** it MUST run `bun run pr:body:check -- --body-file <body-file> --title "<title>"` before `gh pr edit --body-file <body-file>`

#### Scenario: PR body preflight is skipped

- **GIVEN** a pull request body is malformed or missing required governance sections
- **WHEN** local preflight is skipped
- **THEN** GitHub Actions PR Governance MUST still evaluate the same PR body policy and fail the pull request before merge
