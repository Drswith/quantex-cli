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

### Requirement: PR body governance MUST be locally executable

The repository SHALL expose PR body governance as a local script used by both contributors and GitHub Actions. The script SHALL validate required PR sections, linked artifacts, process-only release metadata, and product-impacting release intent using the canonical repository taxonomy.

#### Scenario: Contributor validates a PR body locally

- **WHEN** a contributor or agent prepares a PR body
- **THEN** they can run the local PR body governance command with the body, title, and changed file list
- **AND** the command reports the same required-heading and linked-artifact failures that PR Governance would report remotely

#### Scenario: GitHub validates a PR body

- **WHEN** PR Governance runs for a pull request
- **THEN** it invokes the shared local PR body governance script
- **AND** it does not maintain an independent copy of the required-heading or release-intent logic inline in workflow YAML

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
- **AND** Release PR Automerge validates the release branch, title, generated marker, and changed file scope
- **AND** it rejects a generated Release PR whose proposed semantic version is less than or equal to the current version on the protected base branch

### Requirement: Protected-branch CI MUST reject prohibited co-author trailers in new commits

Repository CI SHALL reject newly introduced commits on pull requests and protected-branch pushes when their commit messages contain `Co-authored-by:` trailers. PR Governance SHALL also reject pull requests before merge when their commit metadata is likely to make GitHub synthesize prohibited co-author trailers into the final squash merge commit.

#### Scenario: Pull request introduces co-author trailer

- **WHEN** CI evaluates the commits introduced by a pull request targeting a protected branch
- **AND** any of those commit messages contains a `Co-authored-by:` trailer
- **THEN** CI fails before merge
- **AND** it reports the offending commit SHA and trailer line

#### Scenario: Pull request would generate co-author trailer on squash merge

- **WHEN** PR Governance evaluates a pull request targeting a protected branch
- **AND** its commit shape is unsafe for GitHub squash merge under the no-co-author-trailer policy
- **THEN** PR Governance fails before merge
- **AND** it explains how to pre-squash or re-author the pull request commits before retrying

#### Scenario: Protected-branch push introduces co-author trailer

- **WHEN** CI evaluates the commits introduced by a direct push to a protected branch
- **AND** any of those commit messages contains a `Co-authored-by:` trailer
- **THEN** CI fails before downstream release automation treats the push as releasable history
- **AND** it reports the offending commit SHA and trailer line

### Requirement: PR body governance MUST be run before PR delivery actions

Agents and contributors SHALL run the local PR body governance command before creating a pull request or editing a pull request body when they provide a body manually. The repository SHALL prefer native GitHub CLI PR commands with a validated body file over repo-local commands that wrap PR creation.

#### Scenario: Agent creates a pull request

- **GIVEN** an agent has prepared a branch for PR delivery
- **WHEN** the agent writes the pull request body
- **THEN** it MUST write the body to a file based on `.github/pull_request_template.md`
- **AND** it MUST run `bun run pr:body:check -- --body-file <body-file> --title "<title>"` before `gh pr create --body-file <body-file>`

#### Scenario: Agent edits a pull request body

- **GIVEN** an agent needs to update an existing pull request body
- **WHEN** the agent prepares the replacement body manually
- **THEN** it MUST run `bun run pr:body:check -- --body-file <body-file> --title "<title>"` before `gh pr edit --body-file <body-file>`

#### Scenario: PR body preflight is skipped

- **GIVEN** a pull request body is malformed or missing required governance sections
- **WHEN** local preflight is skipped
- **THEN** GitHub Actions PR Governance MUST still evaluate the same PR body policy and fail the pull request before merge
