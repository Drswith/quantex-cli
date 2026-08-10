## MODIFIED Requirements

### Requirement: The probe scenario MUST verify installed-version evidence

The lifecycle smoke `probe` scenario MUST install each selected agent, refresh `inspect` and `list`, and require a non-empty installed version for matrix entries whose candidate declares an installed-version probe. It MUST fail when required version evidence is absent and MUST preserve the selected agent for cleanup when any assertion fails.

The probe MUST assert the lifecycle classification implied by the matrix entry's selected provider rather than requiring a single classification for every agent. A provider that Quantex classifies as unmanaged MUST NOT fail the probe for reporting `unmanaged`.

#### Scenario: Version is exposed after installation

- **WHEN** a selected agent installs successfully and its candidate declares an installed-version probe
- **THEN** refreshed inspection and the corresponding list row contain a non-empty installed version

#### Scenario: Missing version is surfaced as a canary failure

- **WHEN** installation succeeds but refreshed inspection has no required installed version
- **THEN** the probe exits non-zero with the agent name in the failure message

#### Scenario: Probe cleanup runs after a failed assertion

- **WHEN** a probe assertion fails after installation
- **THEN** the smoke process attempts to uninstall the selected agent before exiting

#### Scenario: Script-provider agent reports an unmanaged lifecycle

- **GIVEN** the matrix entry selected a provider that Quantex classifies as unmanaged
- **WHEN** the probe inspects the agent after installation
- **THEN** the probe accepts the reported `unmanaged` lifecycle and does not fail

#### Scenario: Managed provider still requires a managed lifecycle

- **GIVEN** the matrix entry selected a provider that Quantex classifies as managed
- **WHEN** refreshed inspection reports a lifecycle other than `managed`
- **THEN** the probe exits non-zero with the agent name in the failure message
