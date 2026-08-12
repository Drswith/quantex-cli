## ADDED Requirements

### Requirement: uv-backed disposable canaries MUST disable a non-invalidating package cache

The real-agent canary workflow MUST disable `setup-uv`'s persisted package cache when the repository has no checked-in Python dependency manifest capable of invalidating that cache. It MUST continue to install uv and execute the selected agent lifecycle, and it MUST NOT merely suppress the missing-dependency warning while retaining a `no-dependency-glob` cache.

#### Scenario: uv provider has no repository dependency manifest

- **GIVEN** a canary matrix entry uses uv and the repository contains no matching Python dependency or lock file
- **WHEN** the workflow prepares the uv provider on a GitHub-hosted runner
- **THEN** setup-uv dependency caching is explicitly disabled
- **AND** the agent install, inspection, version, list, and cleanup lifecycle still executes
