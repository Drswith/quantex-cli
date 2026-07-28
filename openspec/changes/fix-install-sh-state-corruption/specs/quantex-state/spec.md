## ADDED Requirements

### Requirement: Bootstrap installers that mutate state MUST fail closed and write atomically

Public Quantex bootstrap installers that update `state.json` MUST obey the same fail-closed and atomic-write safety contract as the CLI: they MUST NOT substitute empty default state over an unreadable or unsafe existing file, and they MUST replace `state.json` only after a complete temporary write.

#### Scenario: install.sh leaves corrupt state untouched

- **GIVEN** `~/.quantex/state.json` exists with previously recorded `installedAgents` or lifecycle evidence
- **AND** the file contents are not valid JSON or are not a JSON object
- **WHEN** `install.sh` attempts to record `self.installSource = "binary"`
- **THEN** it leaves the existing `state.json` contents unchanged
- **AND** it does not overwrite the file with empty default state
- **AND** the standalone binary installation itself still completes

#### Scenario: install.sh updates readable state through atomic replace

- **GIVEN** a readable object-shaped `state.json` already exists under the Quantex config directory
- **WHEN** `install.sh` records `self.installSource = "binary"`
- **THEN** it preserves existing `installedAgents` and lifecycle evidence fields
- **AND** it writes the updated document to a temporary file in the same directory first
- **AND** it replaces `state.json` only via an atomic rename of that completed temporary file

#### Scenario: install.sh creates missing state safely

- **GIVEN** no `state.json` exists under the Quantex config directory
- **WHEN** `install.sh` records `self.installSource = "binary"`
- **THEN** it may create a new state document that sets `self.installSource` to `binary`
- **AND** it still writes that document through a temporary file and atomic rename
