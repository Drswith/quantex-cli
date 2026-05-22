## MODIFIED Requirements

### Requirement: Optional isolation validation commands

The repository SHALL expose `bun run test:sandbox` and `bun run test:container` as optional maintainer-facing validation commands for running real Quantex agent lifecycle smoke checks inside isolated Bun environments. These commands MUST complement rather than replace the canonical local `bun run test` workflow.

#### Scenario: Isolation smoke includes Bun-managed self-upgrade

- **WHEN** the isolated lifecycle smoke script runs the default self-upgrade coverage
- **THEN** it seeds a Bun-managed Quantex install from a sandbox-local registry at a version older than the current checkout package
- **AND** `quantex upgrade --check --no-cache` reports that a newer self version is available from that local registry
- **AND** `quantex upgrade --no-cache` upgrades the managed install to the current checkout package version
- **AND** the upgraded sandbox `qtx --version` output matches that current checkout package version

#### Scenario: Isolation smoke includes uv-managed lifecycle routing

- **WHEN** the isolated lifecycle smoke script runs the uv-managed coverage
- **THEN** it executes a uv-managed test agent lifecycle with an isolated fake `uv` executable
- **AND** the smoke verifies that Quantex calls `uv tool install`, `uv tool upgrade`, `uv tool uninstall`, and `uv tool list`
- **AND** package-specific uv install arguments are preserved in the install and upgrade commands
- **AND** the scenario avoids real Python package installation and network access

### Requirement: Modal-backed isolation workflow remains separate from merge-gating CI

The repository SHALL keep Modal-backed isolation validation in a dedicated GitHub Actions workflow instead of adding it to the merge-gating `ci.yml` workflow.

#### Scenario: Documentation-only merge reaches a protected branch

- **WHEN** a merge to `main` or `beta` changes only documentation or OpenSpec archive files
- **THEN** the dedicated Modal sandbox workflow does not run automatically from the protected-branch push
- **AND** maintainers can still start the sandbox workflow manually

#### Scenario: Lifecycle-sensitive repository pull request targets main

- **WHEN** a pull request from a branch in the repository changes agent definitions, lifecycle commands, install or update helpers, sandbox scripts, package metadata, or the sandbox workflow itself
- **THEN** the dedicated sandbox workflow runs a scoped Modal merge-gating profile before merge
- **AND** that profile covers stable lifecycle scenarios such as `managed`, `uv-managed`, `adopt-preinstalled`, `ambiguous-multi-method`, and `self-binary`
- **AND** a failing `sandbox-tests` context blocks merge through the active ruleset

#### Scenario: Lifecycle-sensitive merge reaches a protected branch

- **WHEN** a merge to `main` or `beta` changes agent definitions, lifecycle commands, install/update helpers, sandbox scripts, package metadata, or the sandbox workflow itself
- **THEN** the dedicated Modal sandbox workflow runs automatically from the protected-branch push
- **AND** the protected-branch default scenario set includes `uv-managed`
