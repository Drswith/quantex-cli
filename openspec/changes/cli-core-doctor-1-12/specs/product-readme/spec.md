## MODIFIED Requirements

### Requirement: README documents the bounded Core-default routing stage

The English and Simplified Chinese product READMEs SHALL describe that 1.12
continues the staged Core rebuild by making in-repo Core the CLI default engine
for `install`, `ensure`, `update`, and `uninstall`, by observing CLI `inspect`,
`info`, `resolve`, and `list` through in-repo Core read ports, by launching CLI
`exec` / shortcut through an in-repo Core execution engine, and by diagnosing
CLI `doctor` through an in-repo Core diagnosis engine. They MUST state that the
published `quantex-core` SDK does not gain methods from this CLI promotion, that
package/binary/state identities remain v1-compatible, and that removal of
retained legacy escape routes remains subject to the full soak plus a separately
approved later-major proposal.

#### Scenario: a user reads either product README during the 1.12 slice

- **WHEN** a user reads either product README after the 1.12 CLI Core slices
- **THEN** it identifies `install`, `ensure`, `update`, and `uninstall` as
  Core-default CLI operations
- **AND THEN** it identifies `inspect`, `info`, `resolve`, and `list` as
  Core-backed CLI read observation commands
- **AND THEN** it identifies `exec` and shortcut launch as Core-backed CLI
  execution
- **AND THEN** it identifies `doctor` as a Core-backed CLI diagnosis command
- **AND THEN** it does not imply that the published SDK added methods because
  of those CLI routes
