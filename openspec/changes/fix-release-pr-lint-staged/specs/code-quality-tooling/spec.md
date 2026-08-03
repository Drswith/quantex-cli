## MODIFIED Requirements

### Requirement: Pre-commit lint and format enforcement

The repository SHALL enforce lint and format on staged files before each commit through `simple-git-hooks` and `lint-staged`. The pre-commit hook MUST run `oxfmt` only on staged files supported by the formatter in this repository configuration, and MUST run `oxlint --fix` only on staged JavaScript or TypeScript files after formatting, so that the linter sees post-formatter content without being invoked on unsupported file types. When every matched JavaScript or TypeScript path is excluded by oxlint configuration, the lint invocation MUST be a successful no-op; real diagnostics for matched files MUST remain commit-blocking.

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
