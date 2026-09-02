## ADDED Requirements

### Requirement: Governance SHALL split human PR heuristics from Release Please validation

The consolidated `ci.yml` `governance` job SHALL apply human PR body and commit-policy heuristic checks only to non-release-please pull requests. For pull requests whose head branch starts with `release-please--branches--`, the job SHALL run the dedicated Release PR policy validator and SHALL skip `pr:body:check` and `ci:commit-policy` so those human heuristics cannot fail the job. Release-As verification SHALL continue to skip on release-please heads as today.

#### Scenario: Human pull request runs full governance heuristics

- **WHEN** a non-release-please pull request targets `main`
- **THEN** `governance` MUST run PR body validation and commit-policy validation
- **AND** it MUST still evaluate Release-As verification when applicable

#### Scenario: Release Please pull request uses dedicated validation only

- **WHEN** a pull request head branch starts with `release-please--branches--`
- **THEN** `governance` MUST run `ci:release-pr-policy`
- **AND** it MUST skip `pr:body:check`
- **AND** it MUST skip `ci:commit-policy`
- **AND** a failure of those skipped human heuristics MUST NOT be able to fail the job

## MODIFIED Requirements

### Requirement: CI SHALL run on consolidated workflow entry points

Lint, governance, and test jobs SHALL be defined in a consolidated `ci.yml` workflow. PR body validation SHALL run within `ci.yml` rather than a separate `pr-governance.yml` workflow. PR body validation inside `governance` SHALL apply to human pull requests; automated Release Please pull requests SHALL use the dedicated Release PR validator path instead of the human PR body heuristic step.

#### Scenario: single CI workflow for merge gates

- **WHEN** a PR targets `main`
- **THEN** `ci.yml` MUST provide lint, test matrix, and PR governance validation jobs
- **AND** `pr-governance.yml` MUST NOT exist as a separate workflow

#### Scenario: Release Please PRs stay inside consolidated governance

- **WHEN** a release-please Release PR targets `main`
- **THEN** its merge-gating governance MUST still run inside the consolidated `ci.yml` `governance` job
- **AND** that job MUST use the dedicated Release PR validator rather than the human PR body heuristic step
