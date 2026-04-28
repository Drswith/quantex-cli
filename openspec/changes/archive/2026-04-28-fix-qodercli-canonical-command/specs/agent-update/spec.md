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
