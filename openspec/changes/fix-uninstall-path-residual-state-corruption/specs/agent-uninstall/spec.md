## ADDED Requirements

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
