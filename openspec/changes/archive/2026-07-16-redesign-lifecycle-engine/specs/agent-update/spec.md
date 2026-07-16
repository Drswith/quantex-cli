## ADDED Requirements

### Requirement: Update planning MUST reconcile live observations with recorded source evidence

Before choosing an update action, Quantex MUST observe current provider-package presence, executable presence, and version state through the available declarative probes. A recorded lifecycle receipt SHALL remain evidence of the selected install source, but MUST NOT be treated as proof that the recorded package is still live. Compatible receipt and live evidence MUST preserve source-aware update behavior, while conflicting or inconclusive evidence MUST NOT be replaced by a guessed candidate source.

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

### Requirement: Update plans MUST be constrained by provider capabilities

Quantex SHALL build an automatic update plan only from operations and probes declared by the reconciled provider. The plan MUST require every provider capability needed by its chosen strategy, including update execution and the observations needed to verify completion, and SHALL return a manual or explanatory outcome when those capabilities are unavailable.

#### Scenario: Provider supports the complete update strategy

- **GIVEN** the reconciled provider declares update execution plus the probes needed by the strategy before and after execution
- **WHEN** Quantex builds an update plan
- **THEN** the plan uses those provider capabilities with the bound package identity
- **AND** it records the live postconditions that must hold before the update can be reported as completed

#### Scenario: Provider cannot support a verifiable automatic update

- **GIVEN** the reconciled provider does not declare an update operation or a probe required to verify the chosen strategy
- **WHEN** Quantex builds an update plan
- **THEN** Quantex does not substitute another provider or execute an unverifiable automatic update
- **AND** it returns a manual or explanatory outcome for that installation

### Requirement: Version decisions MUST use semantic ordering and MUST NOT silently downgrade

When installed and target versions can be normalized as semantic versions, Quantex MUST compare them using semantic precedence, including prerelease precedence, and SHALL plan an upgrade only when the target version is newer. Quantex MUST NOT automatically install an older target version. A downgrade SHALL require a separately specified explicit user intent; without that intent, the current lifecycle surface MUST remain non-mutating.

#### Scenario: Semantic ordering prevents a lexical downgrade

- **GIVEN** the installed version is `2.10.0`
- **AND** the observed target version is `2.9.0`
- **AND** the user supplied no explicit downgrade intent
- **WHEN** Quantex compares the versions for update planning
- **THEN** Quantex treats `2.10.0` as newer by semantic precedence
- **AND** it does not invoke the provider update operation
- **AND** it reports a non-mutating outcome rather than silently downgrading

#### Scenario: A newer semantic target produces an upgrade plan

- **GIVEN** the installed version is `1.9.0`
- **AND** the observed target version is `1.10.0`
- **WHEN** Quantex compares the versions for update planning
- **THEN** Quantex treats `1.10.0` as newer by semantic precedence
- **AND** the update plan targets `1.10.0`

#### Scenario: Unparseable versions do not fall back to lexical ordering

- **GIVEN** either the installed version or target version cannot be normalized as a semantic version
- **WHEN** Quantex evaluates whether the target is newer
- **THEN** Quantex does not decide upgrade or downgrade order through raw string comparison
- **AND** it returns an indeterminate, manual, or provider-specific non-downgrading outcome

### Requirement: Update completion MUST require verified live postconditions

After an automatic update operation, Quantex MUST re-observe live provider, executable, and version state through the plan's declared probes. A successful provider exit SHALL NOT by itself produce an `updated` outcome. Quantex MUST report the update as completed and persist success-state evidence only when the observed state satisfies the planned postconditions without a semantic downgrade.

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
