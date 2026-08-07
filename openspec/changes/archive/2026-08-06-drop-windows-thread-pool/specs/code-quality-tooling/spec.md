# code-quality-tooling Delta

## MODIFIED Requirements

### Requirement: Windows coverage SHALL gate product-impacting pull requests

For pull requests with product-matrix scope, CI SHALL run the full Vitest command in the `test (windows-latest)` job. Windows coverage MUST NOT be limited to post-merge runs.

All three platform jobs SHALL invoke the same test command and SHALL NOT override the Vitest pool. Windows previously passed `--pool=threads`, which runs every worker inside one process and one V8 instance instead of the default per-worker processes. That override was the only difference between the Windows job and the other two, and it correlated with intermittent job deaths that reported no failing test.

A platform-specific pool override SHALL NOT be reintroduced without a recorded reason and evidence that it does not reintroduce those deaths.

#### Scenario: Product-impacting pull request runs Windows tests

- **WHEN** a pull request changes files that require the product test matrix
- **THEN** the `test (windows-latest)` job invokes the full-test command
- **AND** a failure blocks merge through the active ruleset

#### Scenario: Platform jobs agree on the test command

- **WHEN** the platform test jobs are compared
- **THEN** none of them MAY pass a `--pool` override to Vitest

#### Scenario: Process-only pull request skips Windows tests

- **WHEN** a pull request is classified process-only
- **THEN** the `test (windows-latest)` job reports `skipped`
- **AND** merge remains allowed when other required checks pass
