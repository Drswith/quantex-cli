## ADDED Requirements

### Requirement: Update discovery MUST describe the managed batch scope

The command registry SHALL expose the `--managed` update option and the
structured update result SHALL identify managed-only batch output with
`data.scope: "managed"`.

#### Scenario: Machine consumer discovers managed update mode

- **WHEN** a consumer inspects the update command contract or runs a managed
  batch update in JSON mode
- **THEN** the option metadata declares its all-batch constraint
- **AND** the result identifies the managed scope without changing existing
  `all` or `single` values
