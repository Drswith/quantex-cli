## ADDED Requirements

### Requirement: Root markdown allowlist SHALL track canonical README entry points

Repository-native project-memory checks MUST allow the current canonical root README files used for the product landing page and language switching.

#### Scenario: Repository checks root markdown files

- **WHEN** `bun run memory:check` evaluates root-level markdown files
- **THEN** it allows `README.md` as the canonical English landing page
- **AND** it allows `README.zh-CN.md` as the Simplified Chinese product entry point
- **AND** it may continue allowing compatibility README aliases that remain intentionally present
