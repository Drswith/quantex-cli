## MODIFIED Requirements

### Requirement: README documents the bounded Core-default routing stage

The English and Simplified Chinese product READMEs SHALL describe that 1.4
made Core the default apply CLI engine only for `install` and `ensure`, and
that 1.5 is the second Core-default soak with a frozen legacy compatibility
route. They MUST preserve the v1 presentation and state-contract explanation,
name `QUANTEX_INSTALLATION_ENGINE=legacy` as a pre-invocation retry control,
and distinguish that routing transition from the independently published
`quantex-core` SDK. They MUST state that removal remains subject to the full
soak and a separately approved later-major proposal.

#### Scenario: user reviews Core transition guidance

- **WHEN** a user reads either product README during the 1.5 soak
- **THEN** it identifies non-dry-run `install` and `ensure` as the only
  Core-default CLI operations
- **AND THEN** it does not imply that `update`, `uninstall`, or `run` moved
  into Core

#### Scenario: operator needs a compatibility retry route

- **WHEN** an operator reads the Core transition guidance after a routing
  regression
- **THEN** it can find the `QUANTEX_INSTALLATION_ENGINE=legacy`
  whole-invocation retry control and the rollback rehearsal
- **AND THEN** the guidance does not recommend an automatic or
  post-side-effect fallback
