## MODIFIED Requirements

### Requirement: CI lint and format gate

CI workflows that gate merges to `main` (such as `ci.yml` and the manually dispatched `release.yml`) SHALL run both `bun run lint` and `bun run format:check`. CI MUST fail when either command exits non-zero.

#### Scenario: Pull request CI runs lint and format checks

- **WHEN** a pull request targets `main`
- **THEN** CI executes `bun run lint`
- **AND** CI executes `bun run format:check`
- **AND** the workflow status is `failure` if either command exits non-zero

### Requirement: CI SHALL collect change context once through a shared script

Merge-gating workflows SHALL collect changed-file and commit metadata through the shared `ci:context` script instead of inline `github-script` blocks, and downstream jobs SHALL consume the classification outputs rather than re-calling the GitHub API.

#### Scenario: pull request context is computed once

- **WHEN** a pull request targets `main`
- **THEN** the `classify` job computes changed files, commits, and pull request trust exactly once
- **AND** lint, governance, and test jobs consume those outputs through job dependencies
- **AND** no workflow duplicates the file- or commit-listing logic inline in YAML

### Requirement: CI SHALL run on consolidated workflow entry points

Lint, governance, and test jobs SHALL be defined in a consolidated `ci.yml` workflow. PR body validation SHALL run within `ci.yml` rather than a separate `pr-governance.yml` workflow.

#### Scenario: single CI workflow for merge gates

- **WHEN** a PR targets `main`
- **THEN** `ci.yml` MUST provide lint, test matrix, and PR governance validation jobs
- **AND** `pr-governance.yml` MUST NOT exist as a separate workflow

### Requirement: Merge-gating CI scopes cross-platform execution by change impact

The merge-gating CI workflow SHALL classify pull requests and protected-branch pushes as either product-impacting or process-only with the canonical repository taxonomy before deciding whether to run expensive cross-platform test jobs. Process-only changes MAY skip the protected-branch test matrix, but the workflow MUST still execute the required lint and format validation, MUST still publish the same required test job contexts expected by GitHub rulesets, and MUST still run a minimal build guard on Ubuntu.

#### Scenario: Process-only pull request targets main

- **WHEN** a pull request targeting `main` changes only workflow, documentation, OpenSpec, or release-process metadata
- **THEN** merge-gating CI executes the always-on validation jobs for the repository
- **AND** it runs `bun run build` on Ubuntu as a minimal execution guard
- **AND** the `test (ubuntu-latest)`, `test (macos-latest)`, and `test (windows-latest)` contexts are reported without running the full cross-platform test workload

#### Scenario: Product-impacting pull request targets main

- **WHEN** a pull request targeting `main` changes product-impacting files such as `src/**`, install surfaces, package metadata, or runtime scripts
- **THEN** merge-gating CI runs the required test jobs for Ubuntu, macOS, and Windows
- **AND** any failing platform context blocks merge through the existing ruleset
