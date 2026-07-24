## MODIFIED Requirements

### Requirement: Self-upgrade SHALL distinguish unresolved latest versions from semantic up-to-date

When self-upgrade inspection cannot resolve an installable latest version, Quantex SHALL NOT treat `quantex upgrade` as successfully up to date solely because semantic version comparison cannot show a newer target. Plain `quantex upgrade`, `quantex upgrade --check`, and dry-run upgrade SHALL report a structured unavailable result instead of throwing an internal execution error.

#### Scenario: Explicit check when latest version cannot be resolved

- GIVEN self-upgrade inspection yields no installable latest version
- WHEN the user runs `quantex upgrade --check`
- THEN Quantex reports that the latest CLI version cannot be determined
- AND it does not claim the CLI is already up to date
- AND it does not throw an unstructured internal error

#### Scenario: Plain upgrade when latest version cannot be resolved

- GIVEN self-upgrade inspection yields no installable latest version
- WHEN the user runs `quantex upgrade` without `--check`
- THEN Quantex reports a structured unavailable / network error result
- AND it does not attempt self-upgrade mutation
- AND it does not claim the CLI is already up to date
- AND it does not throw an unstructured internal error such as a missing execution result

#### Scenario: Managed install verification when latest metadata was unresolved

- GIVEN self-upgrade inspection yields no installable `latestVersion`
- AND a managed self-upgrade (`npm` / `bun`) completes successfully
- WHEN Quantex verifies the installed CLI version
- THEN it does not fail verification solely because the installed semantic version is unchanged
