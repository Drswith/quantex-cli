# Lifecycle Reconciliation Specification

## Purpose

Define the deterministic observe-plan-execute-verify-record lifecycle contract, typed provider outcomes, and invocation isolation for Quantex agent mutations.
## Requirements
### Requirement: Mutating lifecycle operations reconcile desired state

Quantex SHALL process agent installation, ensure, update, and uninstall operations through the ordered contract `observe -> plan -> execute -> verify -> record`.

#### Scenario: Reconcile an absent required agent

- **GIVEN** an agent is absent and the requested state is installed
- **WHEN** Quantex reconciles the request
- **THEN** Quantex observes the current state, plans the required transition, executes only the planned actions, verifies the resulting state, and records the verified outcome in that order

### Requirement: Reconciliation plans are deterministic and idempotent

Quantex MUST derive an ordered plan from the observed state, requested state, and invocation inputs, and SHALL produce no mutating action when the observed state already satisfies the request.

#### Scenario: Ensure an already satisfied installation

- **GIVEN** the observed agent installation already satisfies the requested state
- **WHEN** Quantex plans an ensure operation
- **THEN** the plan contains no mutating action and repeated reconciliation preserves the same verified state

### Requirement: Verification gates success and durable state

Quantex MUST verify the post-execution state before reporting lifecycle success or persisting the requested state as current.

#### Scenario: Execution completes but verification fails

- **GIVEN** a planned action reports completion but the observed post-execution state does not match the requested state
- **WHEN** Quantex verifies the operation
- **THEN** Quantex reports a structured non-success outcome, does not record the requested state as achieved, and exposes the verification failure for diagnosis

### Requirement: Provider outcomes are typed

Lifecycle providers MUST return machine-interpretable outcomes with a stable outcome kind and structured details, and Quantex MUST NOT use free-form message text to select reconciliation behavior.

#### Scenario: Equivalent provider failures have different messages

- **GIVEN** two provider responses carry the same typed failure kind but different human-readable messages
- **WHEN** Quantex evaluates either response
- **THEN** Quantex selects the same reconciliation branch and maps both responses to the same public outcome class

### Requirement: Invocation context is isolated

Every Quantex invocation MUST carry its own options, environment, input/output channels, cancellation state, and runtime dependencies through all reconciliation phases without leaking mutable state to another invocation.

#### Scenario: Two invocations use different runtime settings

- **GIVEN** two invocations run in the same process with different dry-run, quiet, cache, and cancellation settings
- **WHEN** their lifecycle operations overlap
- **THEN** every reconciliation phase honors only the context of its own invocation

### Requirement: Executable path evidence MUST compare canonical identities

Lifecycle observation MUST compare recorded, provider-reported, and live executable paths by canonical filesystem identity before classifying them as conflicting source evidence.

A lifecycle receipt's recorded executable path is evidence for the version that receipt recorded. When live observation reports a version that is semantically different from the receipt's recorded version, Quantex MUST NOT derive source drift from the receipt's recorded path, because an installer that relocates its executable between releases makes that path stale by construction. Quantex MUST still derive source drift from the receipt's recorded path when the recorded and live versions agree, and when either version is unknown.

Provider-reported and live executable paths are both live evidence and MUST continue to be compared regardless of version.

#### Scenario: Symbolic link and target identify the same executable

- **GIVEN** a lifecycle receipt records a symbolic-link or package-manager shim path
- **AND** live observation resolves that path to its canonical target
- **WHEN** Quantex reconciles the recorded and live executable evidence
- **THEN** Quantex treats the paths as consistent when both resolve to the same filesystem identity
- **AND** it does not report source drift solely because the path strings differ

#### Scenario: Distinct executable targets at the recorded version remain conflicting

- **GIVEN** recorded and live executable paths resolve to different filesystem identities
- **AND** the receipt's recorded version and the live observed version are the same
- **WHEN** Quantex reconciles the executable evidence
- **THEN** Quantex reports conflicting source evidence
- **AND** it does not mutate lifecycle state from that observation

#### Scenario: Relocated executable at a moved-on version is not source drift

- **GIVEN** a lifecycle receipt records an executable path under a version-specific install directory
- **AND** live observation resolves the agent's executable to a different path under a different version-specific install directory
- **AND** the live observed version is semantically different from the receipt's recorded version
- **WHEN** Quantex reconciles the recorded and live executable evidence
- **THEN** Quantex does not report source drift from the recorded path
- **AND** the observation remains eligible for update planning and post-mutation verification

#### Scenario: Unknown version keeps the conservative path comparison

- **GIVEN** recorded and live executable paths resolve to different filesystem identities
- **AND** either the receipt's recorded version or the live observed version is unavailable
- **WHEN** Quantex reconciles the executable evidence
- **THEN** Quantex reports conflicting source evidence
- **AND** it does not mutate lifecycle state from that observation

### Requirement: Agent executable resolution MUST consider known install directories

Quantex SHALL resolve an agent executable by first consulting the inherited `PATH` and, only when that lookup does not resolve, by consulting a deterministic set of known agent install directories derived from the environment and the home directory. A `PATH` hit MUST remain authoritative. Quantex MUST NOT modify the user's `PATH`, MUST NOT write to shell profiles, and MUST NOT search directories outside the known set.

#### Scenario: Executable resolves through PATH

- **GIVEN** an agent executable is reachable through the inherited `PATH`
- **WHEN** Quantex resolves the executable
- **THEN** Quantex reports the path produced by the `PATH` lookup and does not consult the known install directories

#### Scenario: Executable resolves only in a known install directory

- **GIVEN** an installer wrote the agent executable into a known install directory that is absent from the inherited `PATH`
- **WHEN** Quantex resolves the executable
- **THEN** Quantex reports the executable as present with its absolute path in that directory

#### Scenario: Executable is absent everywhere

- **GIVEN** the agent executable is reachable neither through `PATH` nor in any known install directory
- **WHEN** Quantex resolves the executable
- **THEN** Quantex reports the executable as absent

#### Scenario: Both locations carry the executable

- **GIVEN** the agent executable is reachable through `PATH` and a different copy exists in a known install directory
- **WHEN** Quantex resolves the executable
- **THEN** Quantex reports the `PATH` copy

### Requirement: Every availability surface MUST share one resolution rule

Quantex MUST apply the same executable resolution rule to install verification, inspection, listing, diagnostics, uninstall absence confirmation, adoption of untracked installs, and idempotency replay validation. No surface may answer availability from a narrower rule than another.

#### Scenario: Install and inspection agree

- **GIVEN** an install verified an executable that resolves only in a known install directory
- **WHEN** the user subsequently inspects or lists that agent
- **THEN** the agent is reported as installed with the same resolved executable path

#### Scenario: Uninstall does not declare a false removal

- **GIVEN** an uninstall removed the provider target but a resolvable executable remains in a known install directory
- **WHEN** Quantex confirms executable absence
- **THEN** Quantex does not report the executable as removed

### Requirement: A verified install MUST NOT be rolled back for PATH absence alone

Quantex MUST treat an executable that resolves under the shared resolution rule as satisfying the executable-presence postcondition. Quantex MUST NOT run the installation compensator, and MUST NOT report a verification failure, solely because the installed executable's directory is absent from the inherited `PATH`.

#### Scenario: Installer writes outside the inherited PATH

- **GIVEN** an install completes and writes the executable into a known install directory that the running process does not carry on `PATH`
- **WHEN** Quantex verifies the installation postcondition
- **THEN** verification succeeds, the installation is recorded as verified, and the compensator does not run

#### Scenario: Installation genuinely failed

- **GIVEN** an install reports completion but writes no executable that the resolution rule can find
- **WHEN** Quantex verifies the installation postcondition
- **THEN** Quantex reports a structured verification failure and runs the compensator

### Requirement: Execution and version probing MUST use the resolved executable path

When Quantex has resolved an absolute executable path for an agent, it SHALL launch that agent and probe its installed version through the resolved path rather than through the bare executable name. A catalog version-probe command whose first argument is not the agent's executable name MUST be invoked unchanged.

#### Scenario: Launching an agent resolved outside PATH

- **GIVEN** Quantex reports an agent as installed with a resolved path outside the inherited `PATH`
- **WHEN** the user runs that agent through Quantex
- **THEN** Quantex launches the resolved absolute path and the agent starts

#### Scenario: Version probe for an agent resolved outside PATH

- **GIVEN** an agent resolves only in a known install directory
- **WHEN** Quantex probes its installed version
- **THEN** Quantex invokes the resolved absolute path and reports the parsed version

#### Scenario: Custom probe command is preserved

- **GIVEN** a catalog entry declares a version-probe command whose first argument is not the agent's executable name
- **WHEN** Quantex probes the installed version
- **THEN** Quantex invokes the declared command without substituting a resolved path

### Requirement: Mutation failures expose the typed failure reason

Quantex MUST expose the underlying typed failure reason, and any provider-supplied remediation, on every non-success lifecycle mutation result. A failure result MUST NOT reduce to a generic message that omits evidence Quantex already holds.

The exposed reason is diagnostic payload. Quantex MUST NOT branch reconciliation, routing, or compensation on its text, so this requirement does not weaken the typed-outcome rule in "Provider outcomes are typed".

#### Scenario: No provider is available for the platform

- **GIVEN** every installation provider declared for an agent on the current platform reports itself unavailable
- **WHEN** Quantex fails the install
- **THEN** the structured failure carries the resolver's reason naming each unavailable provider, and the human failure line states it

#### Scenario: The provider command exits non-zero

- **GIVEN** a selected provider runs an install command that exits non-zero
- **WHEN** Quantex fails the install
- **THEN** the structured failure carries the provider description and its exit code

#### Scenario: Provider remediation survives to the caller

- **GIVEN** a failing resolution carries provider-supplied remediation
- **WHEN** Quantex reports the failure
- **THEN** the remediation is present in the structured failure alongside the reason

#### Scenario: Stable error codes are unchanged

- **GIVEN** a consumer keys on the failure's error code or on an existing lifecycle detail value
- **WHEN** a failure gains a diagnostic reason
- **THEN** the error code and existing lifecycle detail values are byte-identical to what the consumer received before

### Requirement: An undetermined decision is not reported as a verification failure

Quantex MUST distinguish a decide-phase outcome that could not determine the agent's state from a verification failure that follows an executed mutation. A failure that ran no mutation MUST NOT be reported as a failure to verify an installation.

#### Scenario: Decision cannot be determined before any mutation

- **GIVEN** the decide phase returns an indeterminate outcome and no install command has run
- **WHEN** Quantex reports the failure
- **THEN** the result identifies the failure as an undetermined decision, and does not claim the agent could not be verified after installation

#### Scenario: Verification failure after a real mutation is unchanged

- **GIVEN** an install command executed and post-execution verification did not confirm the agent
- **WHEN** Quantex reports the failure
- **THEN** the result continues to report a verification failure

