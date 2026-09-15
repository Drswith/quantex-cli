## MODIFIED Requirements

### Requirement: Update planning MUST reconcile live observations with recorded source evidence

Before choosing an update action, Quantex MUST observe current provider-package presence, executable presence, and version state through the available declarative probes. A recorded lifecycle receipt SHALL remain evidence of the selected install source, but MUST NOT be treated as proof that the recorded package is still live. Compatible receipt and live evidence MUST preserve source-aware update behavior, while conflicting or inconclusive evidence MUST NOT be replaced by a guessed candidate source.

When the bound provider confirms the recorded package or formula is present and does not report a conflicting live executable path, a PATH executable that differs from the receipt path MUST NOT be treated as a recorded-source mismatch. Quantex MUST keep planning against the recorded provider identity. In that relocation case Quantex MUST use the bound provider version as the managed version for update planning and MUST NOT fail closed solely because PATH `--version` still reports the previous binary.

#### Scenario: Live evidence confirms the recorded source

- **GIVEN** an agent receipt identifies an npm provider and package
- **AND** the bound npm presence probe confirms that package is installed
- **AND** the executable and installed-version probes return compatible live observations
- **WHEN** Quantex plans an update for the agent
- **THEN** the plan retains the recorded npm provider and package identity
- **AND** it does not select another install candidate merely because that candidate is also supported

#### Scenario: Live evidence conflicts with the recorded source

- **GIVEN** an agent receipt identifies an npm provider and package
- **AND** the bound npm presence probe confirms that package is absent
- **AND** an executable with the agent's binary name is still present in `PATH`
- **WHEN** Quantex plans an update for the agent
- **THEN** Quantex does not silently update the executable through npm or another candidate provider
- **AND** the plan reports that the recorded source and live installation evidence do not establish a safe automatic update path

#### Scenario: Recorded package source still matches after the PATH executable relocates

- **GIVEN** Codex CLI has recorded bun (or npm) install state for `@openai/codex`
- **AND** the bound provider presence probe confirms that package is installed
- **AND** PATH resolves `/Users/…/.local/bin/codex` instead of the receipt's previous shim path
- **AND** the provider observation does not report a conflicting executable path
- **WHEN** the user runs `quantex update codex` or `quantex update --all`
- **THEN** Quantex plans the update from the recorded bun or npm source
- **AND** it does not fail with a recorded-update-source mismatch
- **AND** it does not substitute `codex --upgrade` for that recorded managed source

#### Scenario: Relocated PATH version lag does not block recorded package planning

- **GIVEN** Codex CLI has recorded bun install state for `@openai/codex`
- **AND** the bound bun presence probe confirms that package is installed at a newer version than PATH `--version`
- **AND** PATH still resolves `/Users/…/.local/bin/codex` instead of the receipt shim
- **AND** the provider observation does not report a conflicting executable path
- **WHEN** the user runs `quantex update codex` or `quantex update --all`
- **THEN** Quantex plans the update from the recorded bun source using the provider version
- **AND** it does not fail with a recorded-update-source mismatch

### Requirement: Update completion MUST require verified live postconditions

After an automatic update operation, Quantex MUST re-observe live provider, executable, and version state through the plan's declared probes. A successful provider exit SHALL NOT by itself produce an `updated` outcome. Quantex MUST report the update as completed and persist success-state evidence only when the observed state satisfies the planned postconditions without a semantic downgrade.

When the recorded target is a package or formula and PATH has relocated off the receipt executable path, post-update verification MUST use the bound provider version. A leftover PATH binary that still reports the previous version MUST NOT by itself produce a postcondition failure.

#### Scenario: Provider success satisfies the planned target

- **GIVEN** an update plan targets semantic version `1.4.0`
- **AND** the provider update operation exits successfully
- **WHEN** post-update probes confirm the bound package and executable are present at version `1.4.0` or a newer semantic version
- **THEN** Quantex reports the agent as updated
- **AND** it persists lifecycle evidence for the same reconciled provider and package identity

#### Scenario: Provider success does not satisfy the planned target

- **GIVEN** an update plan targets semantic version `1.4.0`
- **AND** the provider update operation exits successfully
- **WHEN** post-update probes still observe version `1.3.0`, observe a semantic downgrade, or cannot verify the required live state
- **THEN** Quantex does not report the agent as updated
- **AND** it reports a postcondition failure or inconclusive result
- **AND** it does not replace the recorded source evidence with an unverified success state

#### Scenario: Relocated PATH binary does not fail a completed package update

- **GIVEN** Codex CLI has recorded bun install state for `@openai/codex`
- **AND** PATH resolves `/Users/…/.local/bin/codex` instead of the receipt shim
- **AND** bun updates the recorded package from `0.154.0` to `0.155.0`
- **AND** PATH `--version` still reports `0.154.0`
- **AND** the bun observation reports present at `0.155.0` without a conflicting executable path
- **WHEN** Quantex verifies the update
- **THEN** Quantex reports the agent as updated
- **AND** it persists lifecycle evidence for the recorded bun package identity at `0.155.0`
