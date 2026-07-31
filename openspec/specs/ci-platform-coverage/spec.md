# ci-platform-coverage Specification

## Purpose
TBD - created by archiving change restore-pr-windows-test-split. Update Purpose after archive.
## Requirements
### Requirement: Windows Pull Requests Preserve Build Coverage Without Full Test Execution

For every pull request selected for the product test matrix, CI SHALL install dependencies and build on Windows while skipping the full Windows Vitest command. The required `test (windows-latest)` check context MUST remain present.

#### Scenario: Product-impacting pull request runs CI

- **WHEN** a pull request changes files that require the product test matrix
- **THEN** the Windows job installs dependencies and runs the project build
- **AND THEN** it does not invoke the full Windows Vitest command
- **AND THEN** the `test (windows-latest)` check context completes normally

### Requirement: Windows Full Tests Run After Integration

CI SHALL run the full Windows Vitest command for product-matrix executions triggered by protected-branch pushes, manual dispatches, and scheduled runs.

#### Scenario: Protected-branch integration runs CI

- **WHEN** CI is triggered by a `main` or `beta` push with product-matrix scope
- **THEN** the Windows job invokes the established thread-pool full-test command

#### Scenario: Recurring confidence run executes CI

- **WHEN** CI is triggered by workflow dispatch or schedule with product-matrix scope
- **THEN** the Windows job invokes the established thread-pool full-test command
