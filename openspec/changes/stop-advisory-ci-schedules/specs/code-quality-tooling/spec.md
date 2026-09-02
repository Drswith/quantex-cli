# code-quality-tooling Delta

## MODIFIED Requirements

### Requirement: Modal-backed isolation workflow remains separate from merge-gating CI

Modal-backed isolation coverage SHALL run on manual dispatch only, and SHALL NOT run on a standing schedule or on pull requests. It SHALL remain advisory and SHALL NOT be a required status check.

Per-pull-request execution was removed because the workflow never gated anything: it is advisory by design, fork pull requests skip it for lack of secrets, and its observed failures were external Modal capacity rather than repository regressions. Running it on every pull request paid a full run for a signal nothing consumed. The standing schedule was later removed to cut recurring advisory CI noise; maintainers still dispatch the workflow when they want Modal coverage.

#### Scenario: Pull request does not trigger sandbox tests

- **WHEN** a pull request is opened or updated
- **THEN** the Modal-backed isolation workflow MUST NOT run

#### Scenario: Manual dispatch still provides coverage

- **WHEN** a maintainer dispatches the workflow manually
- **THEN** the Modal-backed isolation coverage MUST run
- **AND** its result MUST remain advisory

#### Scenario: Standing schedule is absent

- **WHEN** a contributor inspects the sandbox-tests workflow triggers
- **THEN** the workflow MUST NOT declare a `schedule` event
- **AND** it MUST still declare `workflow_dispatch`
