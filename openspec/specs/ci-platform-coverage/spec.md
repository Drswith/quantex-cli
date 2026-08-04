# ci-platform-coverage Specification

## Purpose
Define CI platform coverage, honest skip semantics, and required status check behavior across Linux, Windows, and macOS runners.

## Requirements

### Requirement: CI SHALL use honest skip semantics for conditional jobs

CI workflows SHALL use job-level `if` conditions that produce `skipped` status instead of empty-success jobs when tests are not applicable (process-only changes, fork PR sandbox exclusions, Windows PR test exclusions).

#### Scenario: process-only change skips full test matrix

- **WHEN** a PR changes only process/documentation paths classified as non-product-impacting
- **THEN** platform test jobs that are not applicable MUST report `skipped` rather than succeed without running tests

#### Scenario: fork PR skips sandbox tests

- **WHEN** a sandbox-related PR originates from a fork
- **THEN** the sandbox-tests job MUST report `skipped` rather than succeed without running Modal tests

### Requirement: CI SHALL run on consolidated workflow entry points

Lint, governance, and test jobs SHALL be defined in a consolidated `ci.yml` workflow. PR body validation SHALL run within `ci.yml` rather than a separate `pr-governance.yml` workflow.

#### Scenario: single CI workflow for merge gates

- **WHEN** a PR targets `main` or `beta`
- **THEN** `ci.yml` MUST provide lint, test matrix, and PR governance validation jobs
- **AND** `pr-governance.yml` MUST NOT exist as a separate workflow

### Requirement: Windows pull requests SHALL skip the full test job

For pull requests with product-matrix scope, CI SHALL skip the `test (windows-latest)` job entirely rather than running an empty-success build-only step.

#### Scenario: Product-impacting pull request skips Windows tests

- **WHEN** a pull request changes files that require the product test matrix
- **THEN** the `test (windows-latest)` job MUST report `skipped`
- **AND** merge MUST remain allowed when other required checks pass

### Requirement: Windows full tests run after integration

CI SHALL run the full Windows Vitest command for product-matrix executions triggered by protected-branch pushes, manual dispatches, and scheduled runs.

#### Scenario: Protected-branch integration runs CI

- **WHEN** CI is triggered by a `main` or `beta` push with product-matrix scope
- **THEN** the Windows job invokes the established thread-pool full-test command

#### Scenario: Recurring confidence run executes CI

- **WHEN** CI is triggered by workflow dispatch or schedule with product-matrix scope
- **THEN** the Windows job invokes the established thread-pool full-test command
