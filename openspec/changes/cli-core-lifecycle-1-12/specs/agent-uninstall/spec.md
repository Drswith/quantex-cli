## ADDED Requirements

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
