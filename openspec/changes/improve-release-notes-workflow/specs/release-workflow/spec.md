## ADDED Requirements

### Requirement: Release-As footer MUST enter Release PR reconciliation

The protected-branch release resolver SHALL treat a commit with a syntactically non-empty, case-insensitive `Release-As: <version>` footer as release-worthy input for Release PR reconciliation. It MUST NOT require a feature, fix, performance, or breaking-change marker in addition to that footer.

#### Scenario: Neutral commit requests an exact release

- **WHEN** a successful protected-branch CI run covers a commit with `Release-As: <version>` and no other release-worthy conventional marker
- **THEN** the resolver MUST select Release PR mode for that commit
- **AND** release-please MUST remain responsible for interpreting the requested version

#### Scenario: Neutral commit has no Release-As footer

- **WHEN** a successful protected-branch CI run covers a `chore` or `docs` commit without a release-worthy conventional marker or a non-empty Release-As footer
- **THEN** the resolver MUST continue to skip Release PR creation

### Requirement: Generated changelogs MUST show intentional refactors

Stable and beta release-please configuration SHALL render `refactor` conventional commits in a visible `Internal Improvements` changelog section. This presentation rule MUST NOT independently cause a version bump or Release PR.

#### Scenario: Release includes a refactor entry

- **WHEN** release-please generates notes for a release range containing an intentional `refactor` entry
- **THEN** the generated changelog and GitHub Release body MUST include that entry under `Internal Improvements`

#### Scenario: Refactor alone does not release

- **WHEN** the newest successful protected-branch CI run covers only a non-breaking `refactor` commit without Release-As
- **THEN** the repository resolver MUST NOT create a Release PR solely because the changelog type is visible
