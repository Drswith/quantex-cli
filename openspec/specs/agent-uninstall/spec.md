# agent-uninstall Specification

## Purpose
Define the observable behavior and structured error contract for uninstalling agent tooling managed by Quantex.
## Requirements
### Requirement: Uninstall MUST distinguish unmanaged targets from execution failures

Quantex SHALL report a resolved-but-unmanaged uninstall target with a stable structured error distinct from a failed managed uninstall attempt.

#### Scenario: Uninstalling a resolved agent without managed state

- GIVEN a supported agent resolves from the uninstall input
- AND Quantex has no managed installed-state record for that agent
- WHEN the user runs `qtx uninstall <agent>`
- THEN Quantex returns `{ ok: false, error: { code: "UNINSTALL_UNMANAGED", ... } }` in structured output mode
- AND the human output explains that Quantex cannot auto-uninstall the agent because it is unmanaged or untracked
- AND the operation does not invoke package-manager uninstall execution
- AND the message points the user to `qtx inspect <agent>` for details

#### Scenario: Managed uninstall execution still fails generically

- GIVEN a supported agent resolves from the uninstall input
- AND Quantex has a managed installed-state record for that agent
- WHEN managed uninstall execution fails
- THEN Quantex keeps returning `UNINSTALL_FAILED`
- AND the result remains distinguishable from `UNINSTALL_UNMANAGED`

### Requirement: Uninstall planning MUST reconcile receipt, provider, and live executable evidence

Before choosing an uninstall action, Quantex MUST reconcile the recorded lifecycle receipt, presence evidence from the receipt's bound provider and package identity, and live executable evidence from the declared executable probe or `PATH`. A receipt SHALL be treated as source evidence rather than proof of current installation, and executable presence alone MUST NOT authorize a provider uninstall for an unproven package identity.

#### Scenario: Receipt and provider evidence identify a managed uninstall

- **GIVEN** an agent receipt binds an npm provider and package identity
- **AND** the npm presence probe confirms that exact package is installed
- **AND** the agent executable is present in `PATH`
- **WHEN** Quantex plans the uninstall
- **THEN** the plan invokes npm uninstall for the package bound by the receipt
- **AND** it does not substitute a package or provider from another install candidate

#### Scenario: Receipt and cargo provider evidence identify a managed uninstall

- **GIVEN** an agent receipt binds a cargo provider and crate identity
- **AND** the cargo presence probe confirms that exact package is installed
- **AND** the agent executable is present in `PATH`
- **WHEN** Quantex plans the uninstall
- **THEN** the plan invokes cargo uninstall for the package bound by the receipt
- **AND** it does not treat cargo observation as permanently indeterminate

#### Scenario: Receipt and deno provider evidence identify a managed uninstall

- **GIVEN** an agent receipt binds a deno provider and tool identity
- **AND** the deno presence probe confirms that exact global binary is installed
- **AND** the agent executable is present in `PATH`
- **WHEN** Quantex plans the uninstall
- **THEN** the plan invokes deno uninstall for the binary bound by the receipt
- **AND** it does not treat deno observation as permanently indeterminate

#### Scenario: Receipt and pip provider evidence identify a managed uninstall

- **GIVEN** an agent receipt binds a pip provider and package identity
- **AND** the pip presence probe confirms that exact package is installed
- **AND** the agent executable is present in `PATH`
- **WHEN** Quantex plans the uninstall
- **THEN** the plan invokes pip uninstall for the package bound by the receipt
- **AND** it does not treat pip observation as permanently indeterminate

#### Scenario: Receipt and winget provider evidence identify a managed uninstall

- **GIVEN** an agent receipt binds a winget provider and package ID identity
- **AND** the winget presence probe confirms that exact package is installed
- **AND** the agent executable is present in `PATH`
- **WHEN** Quantex plans the uninstall
- **THEN** the plan invokes winget uninstall for the package bound by the receipt
- **AND** it does not treat winget observation as permanently indeterminate

#### Scenario: PATH-only detection does not establish managed ownership

- **GIVEN** an agent executable is present in `PATH`
- **AND** Quantex has no receipt or provider evidence that binds it to a managed package identity
- **WHEN** Quantex plans the uninstall
- **THEN** Quantex does not invoke any candidate provider's uninstall operation
- **AND** it classifies the live executable as unmanaged or untracked

#### Scenario: Inconclusive provider evidence fails closed

- **GIVEN** an agent receipt identifies a managed provider and package
- **AND** the provider presence probe cannot determine whether that package is present or absent
- **WHEN** Quantex plans the uninstall
- **THEN** Quantex does not discard the receipt or guess another provider
- **AND** it returns a failure or inconclusive result without claiming managed removal

### Requirement: Uninstall reconciliation MUST distinguish unmanaged, ghost, and provider failure outcomes

Human-readable and structured uninstall results MUST keep unmanaged installations, ghost receipts, and provider execution or verification failures distinguishable. Quantex SHALL preserve externally owned live installations, clear stale receipts only after conclusive ghost evidence, and retain source evidence when managed removal fails or cannot be verified.

#### Scenario: Unmanaged live installation remains untouched

- **GIVEN** an agent executable is live in `PATH`
- **AND** no receipt and provider evidence establish Quantex-managed ownership
- **WHEN** the user uninstalls the agent
- **THEN** Quantex returns the unmanaged outcome distinct from managed uninstall failure
- **AND** it does not execute a provider uninstall or remove the live executable

#### Scenario: Conclusive ghost receipt is reconciled

- **GIVEN** an agent has a receipt for a bound managed provider and package
- **AND** the provider conclusively reports that package absent
- **AND** no matching live executable is observed
- **WHEN** the user uninstalls the agent
- **THEN** Quantex clears the stale receipt without invoking provider removal
- **AND** the result identifies ghost-state recovery distinctly from unmanaged detection and provider failure

#### Scenario: Provider removal failure preserves evidence

- **GIVEN** an agent receipt and provider presence probe confirm a managed package is installed
- **WHEN** the provider uninstall operation fails or post-uninstall probes still observe the managed package
- **THEN** Quantex returns a provider failure outcome distinct from unmanaged and ghost outcomes
- **AND** it retains the receipt needed for diagnosis or retry
- **AND** it does not claim that the agent was removed

### Requirement: Tracked unmanaged uninstall MUST clear Quantex state without requiring executable removal

When an agent has recorded install state with install type `script` or `binary`, Quantex SHALL treat uninstall as state-only untracking. Quantex MUST remove the installed-agent state entry and any lifecycle receipt for that agent, report command success, and MUST NOT require the live executable to disappear from `PATH` or provider observation to become absent.

#### Scenario: Uninstall tracked script install while executable remains on PATH

- **GIVEN** an agent has recorded install state with install type `script`
- **AND** the agent executable is still present in `PATH`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex removes the installed-agent state entry
- **AND** Quantex removes any lifecycle receipt for that agent
- **AND** the uninstall command reports success
- **AND** Quantex does not require the executable to leave `PATH`
- **AND** Quantex does not claim managed package-manager removal for that install type

#### Scenario: Uninstall tracked binary install while executable remains on PATH

- **GIVEN** an agent has recorded install state with install type `binary`
- **AND** the agent executable is still present in `PATH`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex removes the installed-agent state entry
- **AND** Quantex removes any lifecycle receipt for that agent
- **AND** the uninstall command reports success
- **AND** Quantex does not require the executable to leave `PATH`

#### Scenario: Tracked unmanaged uninstall does not synthesize managed removal evidence

- **GIVEN** an agent has recorded install state with install type `script` or `binary`
- **AND** no lifecycle receipt exists for that agent
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex does not create a lifecycle receipt solely to verify provider removal
- **AND** after success, Quantex has neither installed-agent state nor a lifecycle receipt for that agent

