## MODIFIED Requirements

### Requirement: Bun-managed updates MUST trust requested blocked lifecycle scripts across platform path styles

The agent update system SHALL recognize Bun global untrusted package output for requested managed packages regardless of whether Bun prints `node_modules` paths with POSIX or Windows separators. When the untrusted probe cannot be read after a successful Bun global install or update command, Quantex SHALL NOT report that managed operation as successful.

#### Scenario: Trusting a requested scoped package from Windows Bun output

- **GIVEN** a Bun-managed agent package was requested by `quantex install`, `quantex update <agent>`, or `quantex update --all`
- **AND** `bun pm -g untrusted` reports that package using a Windows-style path such as `.\node_modules\@scope\name @1.2.3`
- **WHEN** the Bun install or update command exits successfully
- **THEN** Quantex trusts the requested package lifecycle script
- **AND** the managed operation is reported as successful only after trust completes successfully

#### Scenario: Trusting only requested packages from mixed untrusted output

- **GIVEN** a Bun-managed install or update requested one or more package names
- **AND** `bun pm -g untrusted` reports additional packages that were not requested
- **WHEN** Quantex evaluates blocked lifecycle scripts
- **THEN** Quantex only trusts blocked packages whose names match the requested package list

#### Scenario: Failing closed when the untrusted probe is unavailable

- **GIVEN** a Bun-managed install or update requested one or more package names
- **AND** the Bun global install or update command exits successfully
- **AND** `bun pm -g untrusted` exits non-zero or cannot be executed
- **WHEN** Quantex evaluates blocked lifecycle scripts
- **THEN** Quantex reports the managed operation as failed
- **AND** it does not claim the install or update succeeded without completing trust verification
