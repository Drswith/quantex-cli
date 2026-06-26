## MODIFIED Requirements

### Requirement: Single-agent update MUST choose an appropriate strategy

The agent update system SHALL choose the best available update strategy for a single agent based on the recorded install source and agent capabilities. When recorded install state exists, Quantex MUST NOT override that source by inferring a different managed installer from candidate install methods.

#### Scenario: Managed install rolls back when state persistence fails

- GIVEN a managed install command succeeds for an agent
- WHEN Quantex cannot persist the installed-agent state immediately afterward
- THEN Quantex attempts to roll back the managed install
- AND the install operation surfaces the state persistence failure

#### Scenario: Managed update keeps tracked state when cancellation follows a successful recorded update

- GIVEN an agent has recorded managed install state
- AND a managed update command succeeds for that recorded source
- WHEN Quantex observes cancellation after re-persisting the recorded install state
- THEN Quantex reports update failure to callers
- AND it does not remove the agent's installed-agent state entry

#### Scenario: Managed catalog-fallback update rolls back when state persistence is cancelled

- GIVEN an agent has no recorded install state
- AND a managed update command succeeds through a catalog install method
- WHEN Quantex cannot persist installed-agent state because cancellation was observed
- THEN Quantex attempts to roll back the managed update
- AND the update operation reports failure to callers
