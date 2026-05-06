## MODIFIED Requirements

### Requirement: Managed self-upgrade MUST keep registry checks and installs consistent

Managed self-upgrade SHALL use the same resolved registry for package-manager version checks and managed-install execution, SHALL install the selected package tag directly instead of relying on package-manager update semantics, and SHALL not treat a lower reported latest version as an update target.

#### Scenario: Managed self-upgrade suppresses stale downgrade targets

- GIVEN Quantex was installed via `bun` or `npm`
- AND the current CLI version is newer than the resolved `latestVersion` from cache or registry
- WHEN the user runs `quantex upgrade` or `quantex upgrade --check`
- THEN Quantex does not invoke managed self-upgrade toward that lower version
- AND it does not present the lower version as an available update

### Requirement: Self-upgrade MUST expose recovery guidance

The self-upgrade system SHALL provide recovery hints when automatic upgrade is unavailable or fails, and SHALL only advertise self-updates when the resolved latest version is newer than the installed CLI version.

#### Scenario: Doctor suppresses stale self-update warnings

- GIVEN Quantex resolves a self `latestVersion` that is lower than the installed CLI version
- WHEN the user runs `quantex doctor`
- THEN the doctor output does not emit `SELF_UPDATE_AVAILABLE`
- AND it does not label the installed CLI as outdated

#### Scenario: Passive update notices suppress stale self-update warnings

- GIVEN Quantex resolves a self `latestVersion` that is lower than the installed CLI version
- WHEN a successful human-mode command evaluates the passive self-update notice
- THEN Quantex does not display an available-update notice for that lower version
