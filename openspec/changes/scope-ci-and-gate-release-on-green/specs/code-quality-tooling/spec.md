## ADDED Requirements

### Requirement: Merge-gating CI scopes cross-platform execution by change impact

The merge-gating CI workflow SHALL classify pull requests and protected-branch pushes as either product-impacting or process-only before deciding whether to run expensive cross-platform test jobs. Process-only changes MAY skip the protected-branch test matrix, but the workflow MUST still execute the required lint and format validation and MUST still publish the same required test job contexts expected by GitHub rulesets.

#### Scenario: Process-only pull request targets main

- **WHEN** a pull request targeting `main` changes only workflow, documentation, OpenSpec, or release-process metadata
- **THEN** merge-gating CI executes `bun run lint` and `bun run format:check`
- **AND** the `test (ubuntu-latest)`, `test (macos-latest)`, and `test (windows-latest)` contexts are reported without running the full cross-platform test workload

#### Scenario: Product-impacting pull request targets beta

- **WHEN** a pull request targeting `beta` changes product-impacting files such as `src/**`, install surfaces, package metadata, or runtime scripts
- **THEN** merge-gating CI runs the required test jobs for Ubuntu, macOS, and Windows
- **AND** any failing platform context blocks merge through the existing ruleset
