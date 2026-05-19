## MODIFIED Requirements

### Requirement: Self-upgrade MUST expose recovery guidance

The self-upgrade system SHALL provide recovery hints when automatic upgrade is unavailable or fails, and SHALL support a passive reminder path for outdated installs during other human-mode runtime commands.

#### Scenario: Human runtime command reminds about auto-updatable install

- GIVEN the user runs a successful human-mode runtime command other than `quantex upgrade` or `quantex doctor`
- AND Quantex detects that `latestVersion` is newer than `currentVersion`
- AND the current install source supports auto-update
- WHEN Quantex renders the passive reminder
- THEN it suggests running `quantex upgrade`

#### Scenario: Human runtime command reminds about manual remediation path

- GIVEN the user runs a successful human-mode runtime command other than `quantex upgrade` or `quantex doctor`
- AND Quantex detects that `latestVersion` is newer than `currentVersion`
- AND the current install source does not support auto-update
- WHEN Quantex renders the passive reminder
- THEN it points the user toward `quantex doctor` for source-specific next steps
