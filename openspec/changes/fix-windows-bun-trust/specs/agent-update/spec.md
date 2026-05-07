## ADDED Requirements

### Requirement: Bun-managed updates MUST trust requested blocked lifecycle scripts across platform path styles

The agent update system SHALL recognize Bun global untrusted package output for requested managed packages regardless of whether Bun prints `node_modules` paths with POSIX or Windows separators.

#### Scenario: Trusting a requested scoped package from Windows Bun output

- **GIVEN** a Bun-managed agent package was requested by `quantex install`, `quantex update <agent>`, or `quantex update --all`
- **AND** `bun pm -g untrusted` reports that package using a Windows-style path such as `.\node_modules\@scope\name @1.2.3`
- **WHEN** the Bun install or update command exits successfully
- **THEN** Quantex trusts the requested package lifecycle script
- **AND** the agent update does not leave the requested package's required postinstall blocked because of path separator parsing

#### Scenario: Ignoring unrelated blocked packages

- **GIVEN** a Bun-managed install or update requested one or more package names
- **AND** `bun pm -g untrusted` reports additional packages that were not requested
- **WHEN** Quantex evaluates blocked lifecycle packages
- **THEN** Quantex only trusts blocked packages whose names match the requested package list
