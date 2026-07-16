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

### Requirement: Formatter-ignored milestone fixtures MUST NOT block pre-commit

While lifecycle milestones add hard compatibility fixtures under paths deliberately excluded by the repository formatter configuration, lint-staged SHALL treat an oxfmt invocation whose entire matched set is formatter-ignored as a successful no-op. The repository MUST retain those ignore boundaries, MUST continue formatting supported staged files, and MUST continue running `oxlint --fix` after oxfmt for staged JavaScript and TypeScript. Real formatter or linter failures on supported files MUST remain commit-blocking.

#### Scenario: A milestone stages only ignored JSON fixtures in the JSON formatter group

- **GIVEN** every JSON path selected for one lint-staged oxfmt invocation is excluded by `.oxfmtrc.json`
- **WHEN** the pre-commit hook runs
- **THEN** oxfmt MUST format zero files without failing solely because no supported target remains
- **AND** the ignored fixture bytes MUST remain unchanged

#### Scenario: A milestone also stages formatter-supported source

- **GIVEN** lint-staged selects formatter-supported source in addition to any ignored fixtures
- **WHEN** the pre-commit hook runs
- **THEN** supported files MUST still run through oxfmt
- **AND** staged JavaScript and TypeScript MUST still run through `oxlint --fix` after formatting
- **AND** any real formatter or linter failure MUST still abort the commit
