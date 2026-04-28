## MODIFIED Requirements

### Requirement: Batch update MUST plan from recorded install sources

Batch agent updates SHALL prioritize recorded actual install sources over candidate install methods declared for the agent.

#### Scenario: Updating all installed agents

- GIVEN the user runs `quantex update --all`
- WHEN Quantex builds the update plan
- THEN it groups work by the recorded actual install source where available
- AND it does not rely only on the agent definition's possible install methods

#### Scenario: Skipping untracked PATH detections during batch update

- GIVEN a supported agent binary is available in `PATH`
- AND Quantex has no recorded install state for that agent
- WHEN the user runs `quantex update --all`
- THEN Quantex does not execute managed update or self-update operations for that agent
- AND the batch result explains that the agent was detected in `PATH` but is not tracked as a Quantex-managed install

#### Scenario: Adopting a safely identifiable existing install

- GIVEN a supported agent binary is available in `PATH`
- AND Quantex has no recorded install state for that agent
- AND the current platform exposes exactly one supported unmanaged install method for that agent
- WHEN the user runs `quantex install <agent>` or `quantex ensure <agent>`
- THEN Quantex records that install method as the agent's install state without re-running an installer
- AND later `quantex update --all` plans updates from that recorded state

#### Scenario: Refusing to guess an ambiguous existing install source

- GIVEN a supported agent binary is available in `PATH`
- AND Quantex has no recorded install state for that agent
- AND the current platform exposes multiple plausible install methods or no unambiguous unmanaged install method
- WHEN the user runs `quantex install <agent>` or `quantex ensure <agent>`
- THEN Quantex does not invent or overwrite install state for that agent
- AND the command explains that the install remains untracked
