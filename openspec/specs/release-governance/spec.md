# release-governance Specification

## Purpose
TBD - created by archiving change enforce-release-intent. Update Purpose after archive.
## Requirements
### Requirement: PRs Must Declare Release Intent

Every pull request SHALL include a dedicated release-intent section in its body.

#### Scenario: PR body is validated

- **WHEN** PR Governance validates a pull request body
- **THEN** it requires a `## Release Intent` section alongside the standard summary, artifacts, validation, docs, scope, and closure sections.

### Requirement: Process-only PRs MUST use the shared scope taxonomy for release-metadata enforcement

PR governance SHALL determine whether a pull request is process-only by using the same canonical repository taxonomy as merge-gating CI before enforcing release-metadata restrictions.

#### Scenario: Process-only PR changes workflow or OpenSpec files

- **WHEN** a pull request changes only files classified as process-only by the canonical repository taxonomy
- **THEN** PR governance MUST treat the pull request as process-only for release-metadata enforcement
- **AND** it MUST reject release-worthy conventional metadata such as `feat:`, `fix:`, or `perf:` for that scope

### Requirement: Product-Impacting PRs Must Not Silently Skip Release

PR Governance SHALL reject product-impacting pull requests whose title is not release-worthy unless the PR explicitly declares that release is not applicable with a non-placeholder reason. The product-impacting determination MUST use the same canonical repository taxonomy as merge-gating CI.

#### Scenario: Product-impacting PR has release-worthy title

- **WHEN** a pull request changes files classified as product-impacting by the canonical repository taxonomy
- **AND** its title uses release-worthy conventional metadata such as `feat:`, `fix:`, `perf:`, `type!:` or a breaking-change footer
- **THEN** PR Governance allows the release intent check to pass.

#### Scenario: Product-impacting PR has explicit no-release reason

- **WHEN** a pull request changes files classified as product-impacting by the canonical repository taxonomy
- **AND** its title is not release-worthy
- **AND** its release-intent section says release is not applicable with a meaningful reason
- **THEN** PR Governance allows the release intent check to pass.

#### Scenario: Product-impacting PR has non-release title and no reason

- **WHEN** a pull request changes files classified as product-impacting by the canonical repository taxonomy
- **AND** its title is not release-worthy
- **AND** its release-intent section is missing, empty, or only says a placeholder such as `n/a`
- **THEN** PR Governance fails with guidance to use release-worthy metadata or provide a reason.

### Requirement: Release PRs Keep Dedicated Validation

Release-please generated Release PRs SHALL remain governed by the dedicated Release PR validator instead of the product-impacting release-intent check.

#### Scenario: Release-please PR opens

- **WHEN** a pull request comes from a release-please branch
- **THEN** PR Governance does not require product-impacting release intent for the version-file changes
- **AND** Release PR Automerge validates the release branch, title, generated marker, and changed file scope.
