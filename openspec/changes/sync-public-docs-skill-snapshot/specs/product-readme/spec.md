## MODIFIED Requirements

### Requirement: README Examples Match Current CLI Surface

The root README MUST use command examples and supported-agent references that match the current Quantex CLI surface.

#### Scenario: User copies a README command

- **WHEN** a user copies an install, inspect, ensure, update, upgrade, or execution example from `README.md`
- **THEN** the command reflects an existing Quantex command or documented alias.

#### Scenario: Maintainer follows localized validation guidance

- **WHEN** a maintainer reads local development commands from `README.zh-CN.md`
- **THEN** the listed validation commands cover the same current maintainer-facing checks as `README.md`
- **AND** isolation smoke commands such as `test:container` and `test:sandbox` are documented consistently when they are part of the English README guidance
