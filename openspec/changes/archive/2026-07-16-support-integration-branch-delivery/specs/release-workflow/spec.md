## ADDED Requirements

### Requirement: Temporary lifecycle integration MUST remain outside every release path

The Release workflow and release policy SHALL preserve their positive `main`/`beta` release target allowlist while `codex/redesign-lifecycle-integration` exists. The integration branch MUST NOT trigger automatic release reconciliation, appear as a manual release target, receive a Release PR, or produce an npm tag or channel. This change MUST prove that boundary with regression tests and MUST leave production Release workflow, Release PR, policy, and resolver logic unchanged when the tests pass; only a concrete failing regression MAY justify the smallest production correction. Promotion to `main` MAY enter the normal `main` release flow only after the promotion merge exists on `main`.

#### Scenario: Existing positive allowlist rejects integration before resolution

- **GIVEN** focused regression tests exercise automatic, manual, and Release PR entry gates and prove release-target resolution and npm-channel selection remain downstream of those gates
- **WHEN** the existing `main`/`beta` allowlist rejects `codex/redesign-lifecycle-integration` at every entry point
- **THEN** the bootstrap MUST keep the production Release workflow and resolver surfaces unchanged

#### Scenario: Regression exposes a release boundary gap

- **WHEN** a focused regression proves that an existing production release path accepts `codex/redesign-lifecycle-integration`
- **THEN** the bootstrap MAY change only the smallest production surface necessary to restore the positive `main`/`beta` allowlist
- **AND** the regression MUST pass before delivery

#### Scenario: Successful integration CI completes

- **WHEN** CI succeeds for a pull request or commit associated with `codex/redesign-lifecycle-integration`
- **THEN** the Release `workflow_run` path MUST NOT reconcile or publish that branch

#### Scenario: Maintainer opens manual release dispatch

- **WHEN** a maintainer selects a target for manual Release workflow recovery
- **THEN** only `main` and `beta` MUST be accepted target branches
- **AND** `codex/redesign-lifecycle-integration` MUST NOT be offered or accepted

#### Scenario: Release PR resolution observes integration

- **WHEN** release automation or Release PR validation receives `codex/redesign-lifecycle-integration` as a proposed target or base branch
- **THEN** it MUST refuse to create, update, validate, or automerge a Release PR for that branch

#### Scenario: Integration is blocked before npm channel derivation

- **WHEN** automatic or manual Release workflow entry evaluates `codex/redesign-lifecycle-integration`
- **THEN** the positive branch allowlist MUST reject it before release-target resolution runs
- **AND** npm tag or publishing-channel derivation MUST NOT receive the integration branch
- **AND** no release artifact may be published for that branch

#### Scenario: Final promotion has merged to main

- **GIVEN** the exact integration-to-`main` promotion has merged
- **WHEN** normal successful `main` CI completes for the promoted commit
- **THEN** existing `main` release classification MAY reconcile the product delta
- **AND** the release MUST be attributed to `main`, not to the removed integration branch
