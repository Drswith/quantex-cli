## ADDED Requirements

### Requirement: README documents the bounded Core-default routing stage

The English and Simplified Chinese product READMEs SHALL describe that 1.4 makes Core the default apply CLI engine only for `install` and `ensure`, preserves the v1 presentation and state contracts, and retains the process-scoped `QUANTEX_INSTALLATION_ENGINE=legacy` compatibility route during the 1.5 soak. They MUST distinguish that routing transition from the independently published `quantex-core` SDK.

#### Scenario: user reviews Core transition guidance

- **WHEN** a user reads either product README after the 1.4 promotion
- **THEN** it identifies non-dry-run `install` and `ensure` as the only Core-default CLI operations
- **AND THEN** it does not imply that `update`, `uninstall`, or `run` moved into Core

#### Scenario: operator needs a compatibility retry route

- **WHEN** an operator reads the Core transition guidance after a routing regression
- **THEN** it can find the `QUANTEX_INSTALLATION_ENGINE=legacy` whole-invocation retry control
- **AND THEN** the guidance does not recommend an automatic or post-side-effect fallback
