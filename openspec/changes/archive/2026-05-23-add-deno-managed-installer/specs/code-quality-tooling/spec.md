## ADDED Requirements

### Requirement: Isolation smoke MUST include Deno-managed lifecycle routing

The isolated lifecycle smoke script SHALL include fake-Deno coverage for the Deno-managed install, update, and uninstall command contract without requiring a real Deno package install or network access.

#### Scenario: Isolation smoke includes Deno-managed lifecycle routing

- **WHEN** the isolated lifecycle smoke script runs the Deno-managed coverage
- **THEN** it executes a Deno-managed test agent lifecycle with an isolated fake `deno` executable
- **AND** the smoke verifies that Quantex calls `deno install --global`, `deno install --global --force`, and `deno uninstall --global`
- **AND** package-specific Deno install arguments are preserved in the install and update commands
- **AND** the scenario avoids real Deno package installation and network access
