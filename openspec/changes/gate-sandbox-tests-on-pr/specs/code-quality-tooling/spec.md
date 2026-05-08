## MODIFIED Requirements

### Requirement: Modal-backed isolation workflow remains separate from merge-gating CI

The repository SHALL keep Modal-backed isolation validation in a dedicated GitHub Actions workflow instead of adding it to the merge-gating `ci.yml` workflow. That dedicated workflow SHALL run on pull requests targeting `main` or `beta`, protected-branch pushes, schedule, and manual dispatch, and it SHALL always publish the stable `sandbox-tests` check context expected by repository rulesets.

#### Scenario: Documentation-only pull request targets main

- **WHEN** a pull request targeting `main` changes only documentation, OpenSpec, or other sandbox-irrelevant files
- **THEN** the dedicated sandbox workflow reports a successful `sandbox-tests` context without starting Modal
- **AND** unrelated pull requests are not blocked by a missing required check context

#### Scenario: Lifecycle-sensitive repository pull request targets main

- **WHEN** a pull request from a branch in the repository changes agent definitions, lifecycle commands, install or update helpers, sandbox scripts, package metadata, or the sandbox workflow itself
- **THEN** the dedicated sandbox workflow runs a scoped Modal merge-gating profile before merge
- **AND** that profile covers stable lifecycle scenarios such as `managed`, `adopt-preinstalled`, `ambiguous-multi-method`, and `self-binary`
- **AND** a failing `sandbox-tests` context blocks merge through the active ruleset

#### Scenario: Lifecycle-sensitive fork pull request targets main

- **WHEN** a pull request from a fork changes sandbox-relevant files
- **THEN** the dedicated sandbox workflow remains on the safe `pull_request` event instead of using `pull_request_target`
- **AND** it reports a documented success placeholder rather than running Modal with repository secrets
- **AND** maintainers are instructed to rerun equivalent sandbox validation from a trusted repository branch before merge

#### Scenario: Lifecycle-sensitive merge reaches a protected branch

- **WHEN** a merge to `main` or `beta` changes sandbox-relevant files
- **THEN** the dedicated sandbox workflow still runs automatically from the protected-branch push for post-merge coverage
- **AND** the protected-branch run keeps the broader default scenario set, including `self-managed`
