## MODIFIED Requirements

### Requirement: PR body governance MUST be locally executable

The repository SHALL expose PR body governance as a local script used by both contributors and GitHub Actions. The script SHALL validate required PR sections, linked artifacts, process-only release metadata, and product-impacting release intent using the canonical repository taxonomy.

#### Scenario: Contributor validates a PR body locally

- **WHEN** a contributor or agent prepares a PR body
- **THEN** they can run the local PR body governance command with the body, title, and changed file list
- **AND** the command reports the same required-heading and linked-artifact failures that PR Governance would report remotely

#### Scenario: GitHub validates a PR body

- **WHEN** PR Governance runs for a pull request
- **THEN** it merges the pull request body with the repository governance appendix when that appendix is present
- **AND** it invokes the shared local PR body governance script on the merged body
- **AND** it does not maintain an independent copy of the required-heading or release-intent logic inline in workflow YAML
