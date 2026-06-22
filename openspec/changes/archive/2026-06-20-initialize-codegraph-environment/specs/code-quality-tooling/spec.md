## ADDED Requirements

### Requirement: Codex environment setup MUST prepare deterministic validation tooling

The repository's Codex environment setup SHALL install Bun dependencies with the committed lockfile enforced and SHALL initialize CodeGraph before agent task work begins. The setup contract MUST NOT modify source files, dependency manifests, or lockfiles when the committed dependency graph is already valid.

#### Scenario: Codex environment setup runs

- **WHEN** a Codex environment executes the repository setup script
- **THEN** it runs Bun dependency installation with frozen lockfile semantics
- **AND** it initializes the repository CodeGraph index
- **AND** a valid committed dependency graph remains unchanged

### Requirement: Codex environment cleanup MUST remove transient local artifacts

The repository's Codex environment cleanup SHALL remove transient scratch and package-smoke artifacts that are not source-of-truth repository files. CodeGraph runtime PID and socket files MUST be ignored by git so local indexing coordination state does not appear as reviewable source changes.

#### Scenario: Codex environment cleanup runs

- **WHEN** a Codex environment executes the repository cleanup script
- **THEN** it removes local `.tmp` scratch files
- **AND** it removes local `quantex-*.tgz` package tarballs
- **AND** source files, OpenSpec artifacts, and release source-of-truth files remain outside the cleanup scope

#### Scenario: CodeGraph runtime state changes

- **WHEN** CodeGraph creates local process ID or socket files under `.codegraph/`
- **THEN** git ignores those runtime files
- **AND** they do not appear in the tracked review diff
