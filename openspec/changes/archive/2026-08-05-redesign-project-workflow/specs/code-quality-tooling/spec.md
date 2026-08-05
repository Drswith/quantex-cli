# code-quality-tooling Delta

## ADDED Requirements

### Requirement: Hook installation SHALL be explicit and refreshable

Because `bunfig.toml` sets `ignoreScripts=true` for supply-chain safety, the `prepare` lifecycle script does not install git hooks automatically. The repository SHALL expose `bun run setup` to (re)install `simple-git-hooks`, and contributor-facing documentation SHALL direct developers to run it once after `bun install` and whenever hook definitions change.

#### Scenario: Fresh clone installs hooks

- **WHEN** a contributor clones the repository and runs `bun install`
- **THEN** git hooks are not silently installed by lifecycle scripts
- **AND** running `bun run setup` installs the versioned `simple-git-hooks` definitions from `package.json`

### Requirement: CI SHALL collect change context once through a shared script

Merge-gating workflows SHALL collect changed-file and commit metadata through the shared `ci:context` script instead of inline `github-script` blocks, and downstream jobs SHALL consume the classification outputs rather than re-calling the GitHub API.

#### Scenario: pull request context is computed once

- **WHEN** a pull request targets `main` or `beta`
- **THEN** the `classify` job computes changed files, commits, and pull request trust exactly once
- **AND** lint, governance, and test jobs consume those outputs through job dependencies
- **AND** no workflow duplicates the file- or commit-listing logic inline in YAML

### Requirement: CI SHALL run on consolidated workflow entry points

Lint, governance, and test jobs SHALL be defined in a consolidated `ci.yml` workflow. PR body validation SHALL run within `ci.yml` rather than a separate `pr-governance.yml` workflow.

#### Scenario: single CI workflow for merge gates

- **WHEN** a PR targets `main` or `beta`
- **THEN** `ci.yml` MUST provide lint, test matrix, and PR governance validation jobs
- **AND** `pr-governance.yml` MUST NOT exist as a separate workflow

### Requirement: CI SHALL use honest skip semantics for conditional jobs

CI workflows SHALL use job-level `if` conditions that produce `skipped` status instead of empty-success jobs when tests are not applicable (process-only changes, fork PR sandbox exclusions).

#### Scenario: process-only change skips full test matrix

- **WHEN** a PR changes only process/documentation paths classified as non-product-impacting
- **THEN** platform test jobs that are not applicable MUST report `skipped` rather than succeed without running tests

#### Scenario: fork PR skips sandbox tests

- **WHEN** a sandbox-related PR originates from a fork
- **THEN** the sandbox-tests job MUST report `skipped` rather than succeed without running Modal tests

### Requirement: Windows coverage SHALL gate product-impacting pull requests

For pull requests with product-matrix scope, CI SHALL run the full Windows Vitest command in the `test (windows-latest)` job, using the established thread-pool invocation. Windows coverage MUST NOT be limited to post-merge runs.

#### Scenario: Product-impacting pull request runs Windows tests

- **WHEN** a pull request changes files that require the product test matrix
- **THEN** the `test (windows-latest)` job invokes the established thread-pool full-test command
- **AND** a failure blocks merge through the active ruleset

#### Scenario: Process-only pull request skips Windows tests

- **WHEN** a pull request is classified process-only
- **THEN** the `test (windows-latest)` job reports `skipped`
- **AND** merge remains allowed when other required checks pass

## MODIFIED Requirements

### Requirement: Pre-commit lint and format enforcement

The repository SHALL enforce lint and format on staged files before each commit through `simple-git-hooks` and `lint-staged`. The pre-commit hook MUST run `bunx lint-staged` only: dependency installation belongs to explicit environment setup, not to every commit. lint-staged MUST run `oxfmt` only on staged files supported by the formatter in this repository configuration, and MUST run `oxlint --fix` only on staged JavaScript or TypeScript files after formatting, so that the linter sees post-formatter content without being invoked on unsupported file types. When every matched JavaScript or TypeScript path is excluded by oxlint configuration, the lint invocation MUST be a successful no-op; real diagnostics for matched files MUST remain commit-blocking.

#### Scenario: Contributor commits a staged file

- **GIVEN** a contributor stages files matched by `lint-staged` globs
- **WHEN** the pre-commit hook runs
- **THEN** the hook invokes `oxfmt` on staged formatter-supported files to write formatting fixes
- **AND** then invokes `oxlint --fix` on staged JavaScript or TypeScript files
- **AND** if either step finds a real failure, the commit is aborted

#### Scenario: All staged TypeScript files are ignored by oxlint

- **GIVEN** every staged JavaScript or TypeScript file is excluded by oxlint configuration
- **WHEN** the pre-commit hook runs
- **THEN** oxlint completes successfully without selecting a file
- **AND** the commit is not blocked solely because no lintable target remains

#### Scenario: Contributor stages OpenSpec archive metadata

- **GIVEN** a contributor stages an OpenSpec archive file such as `.openspec.yaml`
- **WHEN** the pre-commit hook runs
- **THEN** the hook does not route that file through an unsupported `oxfmt` invocation
- **AND** the commit is not blocked solely because the formatter cannot handle that file type in the current repository configuration
