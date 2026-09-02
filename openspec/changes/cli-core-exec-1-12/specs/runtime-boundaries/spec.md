## ADDED Requirements

### Requirement: CLI exec and shortcut SHALL remain thin facades over Core execution

Quantex SHALL keep CLI `exec` and shortcut `qtx <agent> [args...]` as thin
compatibility shells for the 1.12 exec slice: they MAY parse argv, choose
`--install` policy, invoke the in-repo Core execution engine through a CLI
bridge, project Core outcomes into maintained v1 human/JSON results, apply exit
policy, and supply process I/O policy (including inherited standard I/O for
human agent launch). They MUST NOT become a second launch-engine implementation
and MUST NOT re-wrap a published SDK `run()` / `exec()` surface into a CLI-only
API.

#### Scenario: Exec command module stays presentation-focused

- **WHEN** a user invokes `exec`
- **THEN** observe/install/launch ownership executes through the Core execution
  engine behind the CLI bridge
- **AND THEN** the command path projects the outcome into the maintained v1 CLI
  result without owning a second launch state machine

#### Scenario: Shortcut stays presentation-focused over the same Core engine

- **WHEN** a user invokes shortcut `qtx <agent> [args...]`
- **THEN** launch executes through the same Core execution engine used by `exec`
- **AND THEN** shortcut argv parsing and process I/O policy remain CLI-owned

#### Scenario: Human agent launch keeps inherited standard I/O

- **WHEN** `exec` or shortcut launches an installed agent in human output mode
- **THEN** the CLI-supplied process I/O policy inherits stdin, stdout, and
  stderr for the agent process
- **AND THEN** that policy is applied through the Core execution engine rather
  than a second CLI-local spawn path
