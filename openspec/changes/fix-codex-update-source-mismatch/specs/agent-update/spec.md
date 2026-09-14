## MODIFIED Requirements

### Requirement: Update planning MUST reconcile live observations with recorded source evidence

Before choosing an update action, Quantex MUST observe current provider-package presence, executable presence, and version state through the available declarative probes. A recorded lifecycle receipt SHALL remain evidence of the selected install source, but MUST NOT be treated as proof that the recorded package is still live. Compatible receipt and live evidence MUST preserve source-aware update behavior, while conflicting or inconclusive evidence MUST NOT be replaced by a guessed candidate source.

When the bound provider confirms the recorded package or formula is present and does not report a conflicting live executable path, a PATH executable that differs from the receipt path MUST NOT be treated as a recorded-source mismatch. Quantex MUST keep planning against the recorded provider identity.

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

## ADDED Requirements

### Requirement: Batch update MUST NOT stall on catalog-only absent agents

When planning `quantex update --all`, Quantex MUST NOT probe catalog providers for an agent that has no PATH executable, no installed-agent state, and no lifecycle receipt. Those agents MUST remain omitted from the batch result as catalog-only absent targets. This skip applies to update planning observation only; install and ensure observation MUST still probe catalog providers for leftover packages.

Human-mode `update --all` MUST write an initial progress line before planning work begins. Structured `--json` output MUST remain a single terminal result with unchanged field names and meanings.

A PATH installed-version probe on the update observation path MUST complete or be abandoned within a bounded probe budget that never exceeds the command `--timeout` when one is set. A probe that hits that budget without command-level cancellation MUST be treated as an unknown installed version for that agent and MUST NOT by itself abort the rest of the batch.

#### Scenario: Catalog-only absent agents are omitted without provider probes

- **GIVEN** the catalog contains agents that are not on PATH and have no installed-agent state and no receipt
- **WHEN** the user runs `quantex update --all`
- **THEN** Quantex does not probe bun, npm, brew, or other catalog providers for those agents
- **AND** those agents are omitted from the batch result

#### Scenario: Human-mode batch update emits progress before planning

- **GIVEN** the user runs `quantex update --all` in human output mode
- **WHEN** Quantex starts the batch
- **THEN** it writes a progress line before it finishes planning every catalog agent
- **AND** `--json` field names, types, and meanings stay unchanged

#### Scenario: Hung PATH version probe does not stall the batch

- **GIVEN** an installed agent whose version command does not return within the update observation probe budget
- **AND** the command-level timeout has not fired
- **WHEN** Quantex observes that agent for `quantex update --all`
- **THEN** it treats the PATH installed version as unknown
- **AND** it continues planning remaining agents
- **AND** a still-present recorded package provider remains eligible for automatic update
