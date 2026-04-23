# Agent Update Specification

## Purpose

Define the current observable behavior and update contract for installed agent tooling managed by Quantex.

## Requirements

### Requirement: Agent update MUST inspect install source and version state

The agent update system SHALL inspect the current install state of an agent before choosing an update path.

#### Scenario: Inspecting an installed agent

- GIVEN the user runs `quantex update <agent>`, `quantex update --all`, `quantex info <agent>`, `quantex list`, or `quantex doctor`
- WHEN Quantex inspects agent state
- THEN it determines whether the agent is installed
- AND reads the recorded or inferred install source needed for update decisions

### Requirement: Single-agent update MUST choose an appropriate strategy

The agent update system SHALL choose the best available update strategy for a single agent based on install source and agent capabilities.

#### Scenario: Updating a managed agent

- GIVEN an agent was installed through a managed package source
- WHEN the user runs `quantex update <agent>`
- THEN Quantex selects the matching managed update path

#### Scenario: Updating an agent that cannot be managed automatically

- GIVEN an installed agent is not updateable through a managed path
- WHEN the user runs `quantex update <agent>`
- THEN Quantex provides a manual or explanatory hint instead of pretending the agent was upgraded

### Requirement: Agent definitions SHOULD declare explicit update metadata when available

The agent catalog SHOULD store verified self-update commands, version probes, package names, and canonical homepages in agent definitions whenever an upstream tool documents them.

#### Scenario: Agent definition includes verified update commands

- GIVEN an upstream CLI documents its own update command
- WHEN Quantex defines or refreshes that agent entry
- THEN the definition records the self-update command explicitly
- AND command-layer update behavior can rely on catalog metadata instead of hardcoded exceptions

#### Scenario: Human update output summarizes mixed outcomes clearly

- GIVEN the user runs `quantex update --all`
- AND the result contains a mix of updated, manual-required, failed, or up-to-date agents
- WHEN Quantex renders human-mode output
- THEN each agent outcome is individually understandable
- AND the command ends with a concise summary of the batch result

### Requirement: Batch update MUST plan from recorded install sources

Batch agent updates SHALL prioritize recorded actual install sources over candidate install methods declared for the agent.

#### Scenario: Updating all installed agents

- GIVEN the user runs `quantex update --all`
- WHEN Quantex builds the update plan
- THEN it groups work by the recorded actual install source where available
- AND it does not rely only on the agent definition's possible install methods

### Requirement: Agent update state MUST remain visible in diagnostics

Agent update behavior SHALL be inspectable through user-facing diagnostic commands.

#### Scenario: Listing or inspecting agent update state

- GIVEN the user runs `quantex list`, `quantex info <agent>`, or `quantex doctor`
- WHEN Quantex renders the result
- THEN the output includes enough install-source and recovery information to explain how update behavior will be chosen

#### Scenario: Doctor JSON exposes machine-actionable agent remediation

- GIVEN the user runs `quantex doctor --json`
- AND Quantex emits an agent-related issue
- WHEN the command returns structured data
- THEN each agent-related issue includes a stable issue code
- AND includes `subject`, `suggestedAction`, and `suggestedCommands`
- AND allows an automation layer to distinguish between inspection, self-update, and manual-follow-up paths

#### Scenario: Resolve exposes machine-actionable install guidance

- GIVEN the user runs `quantex resolve <agent> --json`
- AND the target agent is not installed
- WHEN Quantex returns the structured result
- THEN it keeps the `AGENT_NOT_INSTALLED` error semantics
- AND includes structured install guidance in the result data
- AND that guidance includes a suggested ensure command plus install methods that Quantex can attempt
