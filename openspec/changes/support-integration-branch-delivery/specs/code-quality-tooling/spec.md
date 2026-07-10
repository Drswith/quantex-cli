## ADDED Requirements

### Requirement: Temporary lifecycle integration pull requests MUST use the main merge gates

While `codex/redesign-lifecycle-integration` exists, the repository SHALL run the same merge-gating definitions for a pull request whose base is exactly that branch as it runs for a pull request to `main`. The temporary integration ruleset MUST require pull requests and these six live `protect-main` contexts: `classify`, `lint`, `test (ubuntu-latest)`, `test (windows-latest)`, `test (macos-latest)`, and `sandbox-tests`. CI and Sandbox Tests MUST add the exact integration ref to their `pull_request` base filters and MUST NOT add it to either workflow's `push` filter. PR Governance MUST continue to run for every pull request through its unfiltered trigger, but it MUST NOT be represented as one of the six ruleset contexts.

#### Scenario: Pull request targets the exact integration branch

- **GIVEN** the temporary integration ruleset is active
- **WHEN** a pull request uses `codex/redesign-lifecycle-integration` as its exact base ref
- **THEN** CI and Sandbox Tests MUST run through their `pull_request` triggers and produce all six required contexts used by `main`
- **AND** the ruleset MUST prevent merge until every context succeeds

#### Scenario: PR Governance observes an integration pull request

- **WHEN** any pull request, including an integration-target pull request, is opened or updated
- **THEN** PR Governance MUST run through its existing unfiltered `pull_request` trigger
- **AND** the temporary ruleset MUST NOT substitute its context for `sandbox-tests` or any other live required context

#### Scenario: Integration branch receives a push event

- **WHEN** a commit reaches `codex/redesign-lifecycle-integration`
- **THEN** neither CI nor Sandbox Tests MUST start from an integration-branch `push` trigger
- **AND** pull-request validation MUST remain the branch's merge-gating surface

#### Scenario: Setup creates temporary protection

- **GIVEN** the process-only bootstrap pull request has merged to `main`
- **WHEN** maintainers prepare the integration branch for milestone delivery
- **THEN** they MUST first synchronize the integration ref to the exact post-bootstrap `main` tip and verify it is zero commits ahead and zero commits behind
- **AND** only then MAY they create the ruleset requiring pull requests and the six live `protect-main` contexts defined by this requirement
