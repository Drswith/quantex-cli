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

### Requirement: Residual PATH binaries MUST NOT restore cleared managed uninstall evidence

After a successful managed provider uninstall, Quantex MUST re-check the bound provider before restoring lifecycle evidence on postcondition failure. When the bound provider conclusively reports the managed package absent and only a residual live executable remains on `PATH`, Quantex MUST NOT restore the installed-agent state that the provider uninstall already cleared, MUST clear the lifecycle receipt for that agent, and MUST classify the residual executable as untracked rather than Quantex-owned. Quantex MUST still retain installed-agent state and receipt evidence when the bound provider remains present or provider evidence is indeterminate.

#### Scenario: Residual PATH binary after conclusive managed package removal

- **GIVEN** an agent has managed installed-agent state and a receipt for a bound provider package
- **AND** the provider uninstall removes that package successfully
- **AND** post-uninstall provider observation conclusively reports the bound package absent
- **AND** another copy of the agent executable remains on `PATH`
- **WHEN** the user runs `qtx uninstall <agent>`
- **THEN** Quantex does not restore the cleared installed-agent state
- **AND** it clears the lifecycle receipt
- **AND** it returns a conflicting-source uninstall failure distinct from unmanaged and provider-failure outcomes
- **AND** a later uninstall without restored managed evidence classifies the residual executable as unmanaged or untracked

#### Scenario: Provider still present after uninstall still retains evidence

- **GIVEN** an agent has managed installed-agent state and a receipt for a bound provider package
- **AND** the provider uninstall reports success
- **AND** post-uninstall provider observation still reports the bound package present
- **WHEN** the user runs `qtx uninstall <agent>`
- **THEN** Quantex restores or retains the installed-agent state needed for retry
- **AND** it retains the lifecycle receipt
- **AND** it returns a verification-failed uninstall failure

### Requirement: Bun uninstall MUST reconcile only an unchanged provider-owned global-bin link

When Bun reports a successful package removal and a fresh provider probe conclusively reports the top-level package absent, Quantex MUST remove a remaining global-bin symbolic link only when evidence captured before removal proves that the package declared that binary, the link target belongs to the package or one of its declared runtime dependencies, and the link device, inode, and target are unchanged. Quantex MUST NOT delete a regular file, a changed link, an unproven path, or an alternate source elsewhere on `PATH`.

#### Scenario: Bun leaves the removed package's dependency link behind

- **GIVEN** a Bun-managed package declares the agent binary
- **AND** Bun's global-bin path is a symbolic link to that package or a declared runtime dependency
- **WHEN** Bun removes the top-level package but leaves the exact same link and target behind
- **AND** a fresh Bun package probe reports the top-level package absent
- **THEN** Quantex removes that stale global-bin link
- **AND** normal uninstall absence verification can succeed

#### Scenario: The global-bin link changes during removal

- **GIVEN** Quantex captured a provider-owned Bun global-bin link before removal
- **WHEN** the path's device, inode, or link target differs after Bun removal
- **THEN** Quantex preserves the changed path
- **AND** the normal uninstall postcondition reports any remaining executable instead of treating it as provider-owned cleanup

#### Scenario: Another executable source remains

- **GIVEN** the stale Bun-owned link is safely removed after package removal
- **AND** another copy of the agent executable remains elsewhere on `PATH`
- **WHEN** Quantex verifies uninstall absence
- **THEN** Quantex preserves the other copy
- **AND** it returns the typed `conflicting-source` failure

### Requirement: Uninstall evidence reconciliation MUST apply the agent's default executable name

When comparing the provider binding derived from installed-agent state against the provider binding derived from the lifecycle receipt, Quantex MUST resolve an absent executable name on either side to the agent's declared `binaryName` before deciding whether the two records identify the same source. Recorded evidence that agrees on provider, target identity, and target kind, and differs only by whether the agent's default executable name is spelled out, SHALL NOT be classified as a conflicting source. Quantex MUST still classify a receipt that names a genuinely different executable as a conflicting source.

#### Scenario: Receipt names the agent's default executable and state omits it

- **GIVEN** an agent has installed-agent state for a package provider that records no executable name
- **AND** the lifecycle receipt for that agent binds the same provider, target identity, and target kind
- **AND** the receipt's executable name equals the agent's declared `binaryName`
- **WHEN** the user runs `qtx uninstall <agent>`
- **THEN** Quantex treats the two records as the same source
- **AND** it proceeds to managed uninstall reconciliation instead of returning a `conflicting-source` failure

#### Scenario: State names the agent's default executable and the receipt omits it

- **GIVEN** an agent has installed-agent state whose recorded executable name equals the agent's declared `binaryName`
- **AND** the lifecycle receipt binds the same provider, target identity, and target kind but records no executable name
- **WHEN** the user runs `qtx uninstall <agent>`
- **THEN** Quantex treats the two records as the same source
- **AND** it proceeds to managed uninstall reconciliation instead of returning a `conflicting-source` failure

#### Scenario: Receipt names a different executable

- **GIVEN** an agent has installed-agent state for a package provider
- **AND** the lifecycle receipt binds the same provider and target identity
- **AND** the receipt's executable name differs from both the recorded state executable name and the agent's declared `binaryName`
- **WHEN** the user runs `qtx uninstall <agent>`
- **THEN** Quantex returns the `conflicting-source` uninstall failure
- **AND** it does not invoke provider uninstall

### Requirement: CLI uninstall SHALL execute through the in-repo Core engine by default

Quantex SHALL execute the maintained `uninstall` command contract through the
in-repo Core uninstall engine by default. The observable command names, aliases,
structured error codes such as `UNINSTALL_UNMANAGED` and `UNINSTALL_FAILED`,
exit-code meanings, PATH-only external-agent preservation, and state identities
MUST remain unchanged by the engine relocation.

#### Scenario: Uninstalling a managed agent after the Core relocation

- **GIVEN** a supported agent has managed installed-state evidence
- **WHEN** the user runs `qtx uninstall <agent>` without the legacy engine
  override
- **THEN** Quantex selects the Core uninstall engine before mutation side
  effects
- **AND THEN** the structured success and failure contracts remain the
  maintained v1 uninstall contracts

