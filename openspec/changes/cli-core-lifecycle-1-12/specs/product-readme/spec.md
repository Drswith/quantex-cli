## MODIFIED Requirements

### Requirement: README documents the bounded Core-default routing stage

The English and Simplified Chinese product READMEs SHALL describe that 1.12
continues the staged Core rebuild by making in-repo Core the CLI default engine
for `install`, `ensure`, `update`, and `uninstall`, while `run` / `exec` remain
on their maintained implementations for this slice. They MUST state that the
published `quantex-core` SDK does not gain `update` or `uninstall` methods from
this CLI promotion, that package/binary/state identities remain v1-compatible,
and that removal of retained legacy escape routes remains subject to the full
soak plus a separately approved later-major proposal.

#### Scenario: a user reads either product README during the 1.12 slice

- **WHEN** a user reads either product README after the 1.12 CLI lifecycle slice
- **THEN** it identifies `install`, `ensure`, `update`, and `uninstall` as
  Core-default CLI operations
- **AND THEN** it does not imply that the published SDK added `update` or
  `uninstall` methods
- **AND THEN** it does not imply that `run` / `exec` moved in this slice
