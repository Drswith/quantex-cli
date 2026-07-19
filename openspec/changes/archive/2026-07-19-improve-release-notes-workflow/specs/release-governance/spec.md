## ADDED Requirements

### Requirement: PR governance MUST validate release-summary input

PR Governance SHALL use the shared locally executable body-policy command to validate the release-summary metadata required from release-source PRs.

#### Scenario: Contributor validates release-source metadata locally

- **WHEN** a contributor prepares a release-worthy source PR body
- **THEN** the local body-policy command MUST report missing or malformed release-summary metadata before PR delivery

#### Scenario: Remote governance validates release-source metadata

- **WHEN** GitHub PR Governance evaluates a release-worthy source PR
- **THEN** it MUST invoke the same body-policy validation
- **AND** it MUST reject the PR if the release-summary requirement is not met
