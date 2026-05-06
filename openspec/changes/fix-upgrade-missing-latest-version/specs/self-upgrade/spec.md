## ADDED Requirements

### Requirement: Self-upgrade MUST distinguish unresolved latest versions from semantic “up to date”

When self-upgrade inspection cannot resolve an installable latest version, Quantex MUST NOT report `quantex upgrade` as successfully “up to date” solely because semantic version comparison cannot show a newer target.

#### Scenario: Upgrade check when latest version cannot be resolved

- GIVEN self-upgrade inspection yields no `latestVersion`
- WHEN the user runs `quantex upgrade --check`
- THEN Quantex reports that the latest CLI version cannot be determined
- AND it does not claim the CLI is already up to date
