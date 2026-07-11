## ADDED Requirements

### Requirement: Umbrella changes MUST remain active across milestone delivery

Quantex SHALL permit a large OpenSpec umbrella change to be delivered through multiple reviewed milestone pull requests without treating an intermediate merge as archive eligibility. Each milestone merge MUST report its own validation, PR, and merge closure while the umbrella change remains active until every contracted task is genuinely complete and the final delivery topology has closed.

#### Scenario: Lifecycle milestone merges to integration

- **GIVEN** `redesign-lifecycle-engine` is the active lifecycle umbrella change
- **WHEN** one implementation milestone merges to `codex/redesign-lifecycle-integration`
- **THEN** the milestone MUST report merge closure without reporting umbrella archive closure
- **AND** the redesign task counter MUST change only for implementation tasks actually completed
- **AND** both `redesign-lifecycle-engine` and `support-integration-branch-delivery` MUST remain active

### Requirement: Lifecycle integration delivery MUST include setup, runtime, and teardown

The delivery change SHALL own the complete temporary-branch lifecycle. Setup MUST include the process-only bootstrap on `main`, exact post-bootstrap synchronization, and ruleset creation. Runtime MUST include milestone pull requests and same-repository main synchronization. Teardown MUST include final promotion, integration-specific workflow and policy cleanup, ruleset and branch removal, current-spec synchronization, and archive closure.

#### Scenario: Bootstrap prepares the integration path

- **WHEN** the delivery process is set up
- **THEN** exactly one process-only bootstrap pull request MAY enter `main` before final promotion
- **AND** that pull request MUST NOT include lifecycle redesign implementation
- **AND** integration protection MUST be created only after the branch matches the post-bootstrap `main` tip exactly

#### Scenario: Integration operates between milestones

- **WHEN** lifecycle milestones are delivered before final promotion
- **THEN** they MUST enter the integration branch through pull requests
- **AND** later `main` changes MUST enter integration only through the verified same-repository main-sync topology after protection is active
- **AND** every pull request MUST use rebase merge first or squash merge only as the fallback, without an agent or automation selecting a merge commit
- **AND** neither active OpenSpec change MAY be archived during this runtime phase

#### Scenario: Final promotion becomes eligible

- **GIVEN** `redesign-lifecycle-engine` began this delivery phase at `8/74`
- **WHEN** maintainers propose final integration-to-`main` promotion
- **THEN** the redesign change MUST report exactly `74/74` after its other 73 tasks complete on their existing terms and clarified task `11.6` has real post-promotion follow-up readiness
- **AND** the task `11.6` clarification MUST preserve its number, checkbox, 74-task denominator, implementation scope, and completion credit while deferring actual current-spec synchronization and archive execution
- **AND** a final verified main sync MUST prove through expected-tree and refreshed content-comparison evidence that integration contains the latest `main` content alongside the accepted redesign delta, without requiring the `main` tip to be an ancestor
- **AND** all required redesign validation MUST pass and no lifecycle milestone pull request may remain open

#### Scenario: Redesign task 11.6 is clarified before promotion

- **WHEN** Phase 0/1 resolves the dependency between the `74/74` promotion gate and post-promotion archive closure
- **THEN** it MAY clarify task `11.6` to require a prepared owner, command path, ordering, validation, and protected-branch delivery plan for the post-promotion follow-up
- **AND** it MUST NOT renumber the task, add or remove a checkbox, change the denominator or implementation scope, mark readiness complete before its criteria are met, synchronize current specs, or archive either change before promotion

### Requirement: Archive closure MUST occur after promotion and teardown

Final promotion, product release, teardown, spec synchronization, and OpenSpec archive closure SHALL be reported as separate lifecycle moments. Neither active change MAY be archived before the exact integration-to-`main` promotion has merged, temporary workflow/policy support and repository protection have been removed, and accepted current-spec deltas have been synchronized.

#### Scenario: Final promotion merges to main

- **WHEN** the exact integration-to-`main` pull request merges
- **THEN** maintainers MUST report promotion merge closure separately from release and archive closure
- **AND** both OpenSpec changes MUST remain active while post-promotion teardown is pending

#### Scenario: Post-promotion archive follow-up runs

- **GIVEN** promotion is merged, integration-specific workflow and policy support is cleaned up, the temporary ruleset and branch are removed, and accepted deltas are synchronized into current specs
- **WHEN** the agent-driven archive follow-up runs
- **THEN** it MUST archive both `redesign-lifecycle-engine` and `support-integration-branch-delivery` through the repo-native protected-branch delivery path
- **AND** it MUST validate and report the resulting OpenSpec state
