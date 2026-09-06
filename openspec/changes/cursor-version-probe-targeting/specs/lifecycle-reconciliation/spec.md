## ADDED Requirements

### Requirement: Executable resolution MAY prefer a more specific binary name before `binaryName`

When locating an agent executable for observation, Quantex SHALL try any catalog-declared preferred probe binaries before the agent's `binaryName`. Each name is resolved with the existing PATH-then-known-install-directory rule. The first hit is the resolved executable used for presence, reported path, and version probing.

This does not change the substitution rule: a catalog version-probe command whose first argument is the agent's executable name is still invoked through the resolved absolute path, even when that path's basename differs from `binaryName`.

#### Scenario: Preferred name in a known install directory beats a PATH name collision

- **GIVEN** an unrelated `agent` executable is the first `agent` on `PATH`
- **AND** `cursor-agent` exists only in a known agent install directory
- **WHEN** Quantex observes Cursor CLI
- **THEN** the resolved executable path is that `cursor-agent`
- **AND** the version probe is invoked as that absolute path plus the catalog probe arguments

#### Scenario: Probe command still substitutes when the resolved basename differs

- **GIVEN** Cursor's catalog probe command is `agent --version`
- **AND** observation resolved `/home/user/.local/bin/cursor-agent`
- **WHEN** Quantex probes the installed version
- **THEN** it invokes `/home/user/.local/bin/cursor-agent --version`
- **AND** it does not spawn a bare `agent` from `PATH`
