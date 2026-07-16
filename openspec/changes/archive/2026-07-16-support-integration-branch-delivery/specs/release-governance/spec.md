## ADDED Requirements

### Requirement: Multi-commit pull requests MUST be limited to verified lifecycle integration topology

PR Governance SHALL continue to require exactly one commit for ordinary pull requests. It MAY accept multiple commits only for either a same-repository pull request from `main` to the exact base `codex/redesign-lifecycle-integration` or a same-repository pull request from that exact integration head to `main`. Every remaining pull request in this delivery lifecycle MUST prefer rebase merge and MAY use squash merge only when rebase is unavailable or unsafe. Agents and automation MUST NOT select a merge commit. Because rebase and squash need not preserve source-tip ancestry, synchronization and promotion closure MUST use refreshed comparison, expected-tree, changed-file, and content evidence instead of parent-count or ancestry assertions. Approved tips and expected trees MUST survive process, quota, and network interruption in an untracked per-worktree Git metadata ledger; merge-time verification MUST reload that ledger after fetching and stop on tip drift. Ahead/behind counts and commit logs MUST remain diagnostic and MUST NOT by themselves trigger a repeated synchronization.

#### Scenario: Ordinary milestone contains one commit

- **WHEN** an ordinary milestone pull request contains exactly one commit
- **THEN** it MUST remain eligible for the repository's existing allowed merge methods
- **AND** the operator MUST choose rebase merge first or squash merge only as the fallback
- **AND** an agent or automation MUST NOT choose a merge commit

#### Scenario: Ordinary pull request contains multiple commits

- **WHEN** a pull request contains multiple commits and does not match either exact lifecycle integration topology
- **THEN** PR Governance MUST reject it
- **AND** branch similarity, a lifecycle label, or a process-only diff MUST NOT create an exception

#### Scenario: Same-repository main sync contains multiple commits

- **GIVEN** the base and head repositories are the same Quantex repository
- **WHEN** a pull request has base ref `codex/redesign-lifecycle-integration`, head ref `main`, and multiple commits
- **THEN** PR Governance MAY accept the commit-count exception
- **AND** the pull request MUST pass all required contexts
- **AND** the operator MUST persist the refreshed base/head tips and expected combined content tree in the worktree Git metadata ledger, reload it after a final fetch, and stop for recomputation and review if either tip moved before selecting rebase merge first or squash merge as the fallback

#### Scenario: Exact final promotion contains multiple commits

- **GIVEN** the base and head repositories are the same Quantex repository
- **WHEN** a pull request has base ref `main`, head ref `codex/redesign-lifecycle-integration`, and multiple commits
- **THEN** PR Governance MAY accept the commit-count exception
- **AND** the pull request MUST pass all required contexts
- **AND** the operator MUST persist the refreshed base/head tips and expected promotion content tree in the worktree Git metadata ledger, reload it after a final fetch, and stop for recomputation and review if either tip moved before selecting rebase merge first or squash merge as the fallback

#### Scenario: Lookalike topology attempts the exception

- **WHEN** a multi-commit pull request originates from a fork, reverses the required refs, uses a lookalike integration name, or changes either exact base or head ref
- **THEN** PR Governance MUST reject the commit-count exception

#### Scenario: Exceptional delivery result is verified

- **WHEN** a main-sync or final-promotion exception is merged
- **THEN** the operator MUST refresh the protected target and prove its tree matches the expected result recorded from the approved base and head tips
- **AND** the operator MUST verify the changed files and resulting content comparison contain no unapproved or missing content
- **AND** delivery closure MUST NOT claim that the source tip is an ancestor of the target or require a two-parent result

#### Scenario: Graph divergence has no unsynchronized content

- **GIVEN** rebase or squash history causes `main` and integration commit identities to diverge
- **WHEN** combining the refreshed integration and `main` tips with merge-tree produces the current integration tree
- **THEN** maintainers MUST NOT open another main-sync pull request
- **AND** ahead/behind counts and commit logs MAY be recorded only as graph diagnostics
