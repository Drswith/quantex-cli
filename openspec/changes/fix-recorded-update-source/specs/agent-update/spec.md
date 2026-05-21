## MODIFIED Requirements

### Requirement: Single-agent update MUST choose an appropriate strategy

The agent update system SHALL choose the best available update strategy for a single agent based on the recorded install source and agent capabilities. When recorded install state exists, Quantex MUST NOT override that source by inferring a different managed installer from candidate install methods.

#### Scenario: Updating a managed agent

- GIVEN an agent was installed through a managed package source
- WHEN the user runs `quantex update <agent>`
- THEN Quantex selects the matching managed update path

#### Scenario: Updating an agent that cannot be managed automatically

- GIVEN an installed agent is not updateable through a managed path
- WHEN the user runs `quantex update <agent>`
- THEN Quantex provides a manual or explanatory hint instead of pretending the agent was upgraded

#### Scenario: Recorded unmanaged install is not reclassified as managed

- GIVEN an agent has recorded install state with install type `script` or `binary`
- AND the agent definition also declares a managed install method such as `pip`
- WHEN the user runs `quantex update <agent>`
- THEN Quantex does not select the managed install method from the definition as the update source
- AND it uses a self-update command when available or reports a manual/explanatory outcome
- AND it does not rewrite the recorded install state to the unrelated managed source

#### Scenario: Self-update only reports an upgrade when the installed version changes

- GIVEN an installed agent is updated through a self-update command
- AND Quantex can probe the installed version before and after the command
- WHEN the self-update command exits successfully
- THEN Quantex compares the probed versions
- AND reports the agent as updated only if the installed version changed

#### Scenario: Self-update reports no change when the version stays the same

- GIVEN an installed agent is updated through a self-update command
- AND Quantex can probe the installed version before and after the command
- WHEN the self-update command exits successfully
- BUT the installed version remains the same
- THEN Quantex reports the agent as up to date instead of updated

### Requirement: Batch update MUST plan from recorded install sources

Batch agent updates SHALL prioritize recorded actual install sources over candidate install methods declared for the agent. When recorded install state exists, Quantex MUST NOT group the agent under a different managed installer inferred only from candidate install methods.

#### Scenario: Updating all installed agents

- GIVEN multiple agents have recorded install state
- WHEN the user runs `quantex update --all`
- THEN Quantex groups update work by install type
- AND it groups work by the recorded actual install source where available
- AND it does not rely only on the agent definition's possible install methods

#### Scenario: Tracked unmanaged install is not batched through a candidate managed method

- GIVEN an agent has recorded install state with install type `script` or `binary`
- AND the agent definition also declares a managed install method such as `pip`
- WHEN the user runs `quantex update --all`
- THEN Quantex does not include that agent in a grouped managed update bucket for the candidate method
- AND the agent receives a self-update or manual/explanatory per-agent outcome instead
