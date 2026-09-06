## MODIFIED Requirements

### Requirement: README documents the bounded Core-default routing stage

The English and Simplified Chinese product READMEs SHALL describe that 1.12
continues the staged Core rebuild by making in-repo Core the only CLI engine
for `install`, `ensure`, `update`, and `uninstall`, by observing CLI `inspect`,
`info`, `resolve`, and `list` through in-repo Core read ports, by launching CLI
`exec` / shortcut through an in-repo Core execution engine, by installing a
missing agent for authorized `exec --install` through the same Core
install/ensure engine as CLI install/ensure, and by diagnosing CLI `doctor`
through an in-repo Core diagnosis engine. They MUST also state that CLI
`upgrade` / `qtx upgrade` plan, check, and apply through an in-repo Core
self-upgrade engine. They MUST state that the published `quantex-core` SDK does
not gain methods from this CLI promotion, that package/binary/state identities
remain v1-compatible, that install/ensure `--dry-run` uses Core preview while
preserving the frozen dry-run plan without lifecycle mutation, and that the
former `QUANTEX_INSTALLATION_ENGINE=legacy` install/ensure apply escape is
retired.

#### Scenario: a user reads either product README during the 1.12 slice

- **WHEN** a user reads either product README after the 1.12 CLI Core slices
  and the upgrade knife
- **THEN** it identifies `install`, `ensure`, `update`, and `uninstall` as
  Core-only CLI operations
- **AND THEN** it identifies `inspect`, `info`, `resolve`, and `list` as
  Core-backed CLI read observation commands
- **AND THEN** it identifies `exec` and shortcut launch as Core-backed CLI
  execution
- **AND THEN** it identifies authorized `exec --install` missing-agent
  mutation as sharing the Core install/ensure engine
- **AND THEN** it identifies `doctor` as a Core-backed CLI diagnosis command
- **AND THEN** it identifies `upgrade` as a Core-backed CLI self-upgrade
  command
- **AND THEN** it does not document `QUANTEX_INSTALLATION_ENGINE=legacy` as a
  supported install/ensure recovery route
- **AND THEN** it does not imply that the published SDK added methods because
  of those CLI routes
