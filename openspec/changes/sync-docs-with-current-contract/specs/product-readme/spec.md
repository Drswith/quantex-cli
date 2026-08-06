## ADDED Requirements

### Requirement: README distinguishes the maintained stable release line from self-upgrade selectors

The English and Simplified Chinese product READMEs SHALL identify stable/`main` as the normal Quantex release line and SHALL NOT present a maintained beta release channel. If the READMEs mention `qtx upgrade --channel beta`, they MUST explain that it is an explicit compatibility selector for a prerelease that actually exists, not a repository release workflow.

#### Scenario: User follows README upgrade guidance

- **GIVEN** a user reads the upgrade examples in either product README
- **WHEN** the user chooses a normal Quantex self-upgrade
- **THEN** the documented default path targets the stable release line
- **AND** any beta selector example is clearly qualified as optional and not guaranteed to have a matching release

### Requirement: README explains managed uninstall ownership and residual PATH copies

The English and Simplified Chinese product READMEs SHALL explain that `uninstall` removes an install tracked by Quantex's recorded managed source, does not delete an independently owned executable that remains on `PATH`, and may report a conflicting-source failure after the managed package is conclusively removed but another copy remains.

#### Scenario: User reviews the uninstall command

- **GIVEN** a user reads the common command or lifecycle guidance
- **WHEN** the user runs `qtx uninstall <agent>` for an agent with another copy on `PATH`
- **THEN** the README explains that the other copy is not removed as Quantex-owned state
- **AND** it directs the user to inspect or resolve the executable and remove or manage the remaining copy through its actual owner
