## MODIFIED Requirements

### Requirement: Managed-install package MUST keep runtime CLI files

The npm package consumed by Bun and npm managed installs SHALL still include the runtime CLI files and metadata needed to execute the CLI under supported Node.js and perform lazy self-install-source reconciliation at runtime.

#### Scenario: User installs Quantex from npm or Bun

- **WHEN** the managed-install package is packed for publication
- **THEN** it still contains the runtime CLI files under `dist/` needed for `qtx` and `quantex`
- **AND** the published CLI entrypoint is executable by Node.js
- **AND** it does not require Bun to be present on `PATH` after installation
- **AND** it does not require an install-time `postinstall` entrypoint to preserve the managed self-upgrade contract

