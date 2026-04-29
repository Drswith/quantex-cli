## ADDED Requirements

### Requirement: Workflow scope classification MUST use a canonical repository taxonomy

Repository workflows that distinguish product-impacting changes from process-only changes MUST derive that classification from a single canonical repository taxonomy instead of maintaining independent inline path lists.

#### Scenario: CI classifies a pull request

- **WHEN** merge-gating CI evaluates the changed files for a pull request or protected-branch push
- **THEN** it MUST classify the change with the canonical repository taxonomy
- **AND** it MUST NOT rely on a workflow-local copy of the same product-impacting or process-only path rules

#### Scenario: PR governance validates release intent

- **WHEN** PR governance evaluates whether a pull request is process-only or product-impacting
- **THEN** it MUST use the same canonical repository taxonomy consumed by merge-gating CI
- **AND** the repository MUST be able to update that taxonomy through one source-of-truth change

### Requirement: Pre-push validation MUST enforce repository-wide workflow gates

The repository SHALL enforce a `pre-push` hook through `simple-git-hooks` that runs the repository-wide checks most likely to fail merge-gating CI for durable workflow changes.

#### Scenario: Contributor pushes a branch

- **WHEN** a contributor pushes commits from a clone with repository hooks installed
- **THEN** the `pre-push` hook MUST run `bun run format:check`
- **AND** it MUST run `bun run typecheck`
- **AND** it MUST run `bun run openspec:validate`
- **AND** it MUST run `bun run memory:check`
- **AND** the push MUST be aborted if any of those commands exits non-zero

## MODIFIED Requirements

### Requirement: Merge-gating CI scopes cross-platform execution by change impact

The merge-gating CI workflow SHALL classify pull requests and protected-branch pushes as either product-impacting or process-only with the canonical repository taxonomy before deciding whether to run expensive cross-platform test jobs. Process-only changes MAY skip the protected-branch test matrix, but the workflow MUST still execute the required lint and format validation, MUST still publish the same required test job contexts expected by GitHub rulesets, and MUST still run a minimal build guard on Ubuntu.

#### Scenario: Process-only pull request targets main

- **WHEN** a pull request targeting `main` changes only workflow, documentation, OpenSpec, or release-process metadata
- **THEN** merge-gating CI executes the always-on validation jobs for the repository
- **AND** it runs `bun run build` on Ubuntu as a minimal execution guard
- **AND** the `test (ubuntu-latest)`, `test (macos-latest)`, and `test (windows-latest)` contexts are reported without running the full cross-platform test workload

#### Scenario: Product-impacting pull request targets beta

- **WHEN** a pull request targeting `beta` changes product-impacting files such as `src/**`, install surfaces, package metadata, or runtime scripts
- **THEN** merge-gating CI runs the required test jobs for Ubuntu, macOS, and Windows
- **AND** any failing platform context blocks merge through the existing ruleset
