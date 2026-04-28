## MODIFIED Requirements

### Requirement: Managed-install package MUST keep runtime CLI files

The npm package consumed by Bun and npm managed installs SHALL still include the runtime files needed to execute the CLI and perform lazy self-install-source reconciliation at runtime.

#### Scenario: User installs Quantex from npm or Bun

- **WHEN** the managed-install package is packed for publication
- **THEN** it still contains the runtime CLI files under `dist/` needed for `qtx` and `quantex`
- **AND** it does not require an install-time `postinstall` entrypoint to preserve the managed self-upgrade contract
