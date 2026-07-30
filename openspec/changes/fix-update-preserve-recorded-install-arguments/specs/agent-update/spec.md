## ADDED Requirements

### Requirement: Managed update observation MUST preserve recorded install arguments beside receipts

When Quantex observes a managed agent that has both installed-agent state and a lifecycle receipt for the same provider identity, the binding used for managed update planning and execution MUST preserve any recorded package install arguments from installed state. Lifecycle receipts MAY omit install arguments; observation MUST NOT drop state arguments solely because a narrower receipt binding is preferred for executable identity metadata.

#### Scenario: Updating a Cargo-managed agent with recorded arguments and a matching receipt

- **GIVEN** an agent has recorded install state with install type `cargo` and package install arguments such as `--locked`
- **AND** a lifecycle receipt exists for the same Cargo provider target identity
- **WHEN** Quantex observes the agent for `quantex update <agent>` or `quantex update --all`
- **THEN** the planned update binding includes the recorded Cargo install arguments
- **AND** Quantex runs Cargo update with those recorded arguments

#### Scenario: Updating a uv-managed agent with recorded arguments and a matching receipt

- **GIVEN** an agent has recorded install state with install type `uv` and package install arguments such as `--python 3.12`
- **AND** a lifecycle receipt exists for the same uv provider target identity
- **WHEN** Quantex observes the agent for `quantex update <agent>` or `quantex update --all`
- **THEN** the planned update binding includes the recorded uv install arguments
- **AND** Quantex runs `uv tool upgrade` with those recorded arguments

#### Scenario: Updating a Deno-managed agent with recorded arguments and a matching receipt

- **GIVEN** an agent has recorded install state with install type `deno` and package install arguments such as permission flags
- **AND** a lifecycle receipt exists for the same Deno provider target identity
- **WHEN** Quantex observes the agent for `quantex update <agent>` or `quantex update --all`
- **THEN** the planned update binding includes the recorded Deno install arguments
- **AND** Quantex runs Deno update with those recorded arguments
