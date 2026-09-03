## MODIFIED Requirements

### Requirement: Self-upgrade SHALL distinguish unresolved latest versions from semantic up-to-date

When self-upgrade inspection cannot resolve an installable latest version, Quantex SHALL NOT treat `quantex upgrade` as successfully up to date solely because semantic version comparison cannot show a newer target. Plain `quantex upgrade`, `quantex upgrade --check`, and dry-run MUST report a structured `NETWORK_ERROR` with status `check-unavailable` and MUST NOT throw an unstructured execution error.

#### Scenario: Explicit check when latest version cannot be resolved

- GIVEN self-upgrade inspection yields no installable latest version
- WHEN the user runs `quantex upgrade --check`
- THEN Quantex reports that the latest CLI version cannot be determined
- AND it does not claim the CLI is already up to date
- AND the structured error code is `NETWORK_ERROR`

#### Scenario: Plain upgrade when latest version cannot be resolved

- GIVEN self-upgrade inspection yields no installable latest version
- AND the current install source can auto-update
- WHEN the user runs `quantex upgrade`
- THEN Quantex reports a structured `NETWORK_ERROR`
- AND the result status is `check-unavailable`
- AND it does not throw an unstructured execution error
- AND it does not claim the CLI is already up to date
- AND it does not invoke the self-upgrade mutator

#### Scenario: Managed install verification when latest metadata was unresolved

- GIVEN self-upgrade inspection yields no installable `latestVersion`
- AND a managed self-upgrade (`npm` / `bun`) completes successfully
- WHEN Quantex verifies the installed CLI version
- THEN it does not fail verification solely because the installed semantic version is unchanged

## ADDED Requirements

### Requirement: Self-upgrade check and dry-run MUST keep manual-required classification

When self-upgrade planning classifies the install source as unable to auto-update, `quantex upgrade --check` and dry-run SHALL report structured `MANUAL_ACTION_REQUIRED` and MUST NOT report `NETWORK_ERROR`.

#### Scenario: Explicit check on a non-auto-update install source

- GIVEN the current install source cannot auto-update
- WHEN the user runs `quantex upgrade --check`
- THEN Quantex reports structured `MANUAL_ACTION_REQUIRED`
- AND it does not report `NETWORK_ERROR`
- AND it does not invoke the self-upgrade mutator
