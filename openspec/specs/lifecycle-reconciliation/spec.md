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
