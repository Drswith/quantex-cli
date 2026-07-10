## ADDED Requirements

### Requirement: Multi-commit pull requests MUST be limited to verified lifecycle integration topology

PR Governance SHALL continue to require exactly one commit for ordinary pull requests. It MAY accept multiple commits only for either a same-repository pull request from `main` to the exact base `codex/redesign-lifecycle-integration` or a same-repository pull request from that exact integration head to `main`. Both multi-commit exceptional operations MUST be delivered with a merge commit so accepted ancestry is preserved. This change MUST NOT impose a merge method on ordinary single-commit milestone or product pull requests.

#### Scenario: Ordinary milestone contains one commit

- **WHEN** an ordinary milestone pull request contains exactly one commit
- **THEN** it MUST remain eligible for the repository's existing allowed merge methods
- **AND** this integration change MUST NOT require a merge commit

#### Scenario: Ordinary pull request contains multiple commits

- **WHEN** a pull request contains multiple commits and does not match either exact lifecycle integration topology
- **THEN** PR Governance MUST reject it
- **AND** branch similarity, a lifecycle label, or a process-only diff MUST NOT create an exception

#### Scenario: Same-repository main sync contains multiple commits

- **GIVEN** the base and head repositories are the same Quantex repository
- **WHEN** a pull request has base ref `codex/redesign-lifecycle-integration`, head ref `main`, and multiple commits
- **THEN** PR Governance MAY accept the commit-count exception
- **AND** the pull request MUST pass all required contexts and merge with a merge commit

#### Scenario: Exact final promotion contains multiple commits

- **GIVEN** the base and head repositories are the same Quantex repository
- **WHEN** a pull request has base ref `main`, head ref `codex/redesign-lifecycle-integration`, and multiple commits
- **THEN** PR Governance MAY accept the commit-count exception
- **AND** the pull request MUST pass all required contexts and merge with a merge commit

#### Scenario: Lookalike topology attempts the exception

- **WHEN** a multi-commit pull request originates from a fork, reverses the required refs, uses a lookalike integration name, or changes either exact base or head ref
- **THEN** PR Governance MUST reject the commit-count exception

#### Scenario: Exceptional merge topology is verified

- **WHEN** a main-sync or final-promotion exception is merged
- **THEN** the resulting protected-branch commit MUST have two parents corresponding to the refreshed base and head tips approved by the pull request
- **AND** a squash or rebase result MUST be treated as failed delivery closure for that operation
