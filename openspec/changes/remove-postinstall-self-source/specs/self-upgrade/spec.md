## MODIFIED Requirements

### Requirement: Self-upgrade MUST reconcile persisted install source state

The self-upgrade system SHALL persist self install-source knowledge and reconcile it against runtime detection.

#### Scenario: Using persisted state when runtime detection is inconclusive

- GIVEN Quantex has a stored `state.self.installSource`
- AND the current runtime inspection cannot classify the install source beyond `unknown`
- WHEN Quantex inspects self-upgrade state
- THEN it uses the persisted install source for upgrade planning

#### Scenario: Refreshing stale state when runtime detection changes

- GIVEN Quantex has a stored `state.self.installSource`
- AND runtime inspection resolves a different non-`unknown` install source
- WHEN Quantex inspects self-upgrade state
- THEN it updates the stored install source to the runtime-detected value

#### Scenario: Persisting a managed install source lazily on first inspection

- GIVEN Quantex was installed through a global `bun` or `npm` managed install
- AND `state.self.installSource` is not yet present
- WHEN the user runs a self-inspection surface such as `quantex upgrade`, `quantex upgrade --check`, `quantex doctor`, or `quantex capabilities`
- THEN Quantex detects the managed install source from runtime package metadata or executable layout
- AND it writes that detected source into `state.self.installSource`
- AND later self-upgrade planning uses the stored managed install source without requiring an install-time package script
