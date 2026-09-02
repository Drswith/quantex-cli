## MODIFIED Requirements

### Requirement: README Documents The Core Compatibility Transition

The product README SHALL describe the staged Core compatibility transition for
1.12 without advertising retired install/ensure legacy escapes. It MUST state
that CLI `install` / `ensure` / `update` / `uninstall` route through in-repo
Core engines, that `exec` / shortcut launch through in-repo Core execution, and
that authorized `exec --install` missing-agent mutation uses the same Core
install/ensure engine as CLI install/ensure, while the published SDK still does
not expose `update`, `uninstall`, `run`, or `doctor`.

#### Scenario: Reader scans the 1.12 Core transition wording

- **WHEN** a user reads the README Core compatibility section
- **THEN** they learn that exec/shortcut launch through Core execution and that
  exec `--install` shares the Core install/ensure engine
- **AND THEN** they do not see instructions to set
  `QUANTEX_INSTALLATION_ENGINE=legacy` for install/ensure recovery
