## MODIFIED Requirements
### Requirement: Release Workflow Skips Non-release Pushes

The Release workflow SHALL evaluate release relevance only after merge-gating CI has completed successfully for a protected-branch push, and it SHALL skip release-please for pushes that cannot create a release.

#### Scenario: release-worthy merge reaches main

- **WHEN** merge-gating CI completes successfully for a push to `main`
- **AND** the pushed commit has a release-worthy conventional commit title such as `feat:`, `fix:`, or `perf:`
- **THEN** the Release workflow MUST invoke release-please in Release PR mode
- **AND** the release-please action version MUST be pinned to a repository-verified tag
- **AND** it MUST skip GitHub Release creation in that invocation
- **AND** it MUST derive the next release from the current manifest and published release state instead of a stale repository-pinned baseline override

