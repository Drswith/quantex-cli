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

#### Scenario: Self-update only reports an upgrade when the installed version changes

- GIVEN an installed agent is updated through a self-update command
- AND Quantex can probe the installed version before and after the command
- WHEN the self-update command exits successfully
- THEN Quantex compares the probed versions
- AND reports the agent as updated only if the installed version changed

#### Scenario: Self-update reports no change when the version stays the same

- GIVEN an installed agent is updated through a self-update command
- AND Quantex can probe the installed version before and after the command
- WHEN the self-update command exits successfully
- BUT the installed version remains the same
- THEN Quantex reports the agent as up to date instead of updated

### Requirement: Agent definitions MUST declare explicit update metadata when available

The agent catalog MUST store verified self-update commands, version probes, package names, and canonical homepages in agent definitions whenever an upstream tool documents them.

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

- GIVEN multiple agents have recorded install state
- WHEN the user runs `quantex update --all`
- THEN Quantex groups update work by install type
- AND it groups work by the recorded actual install source where available
- AND it does not rely only on the agent definition's possible install methods

### Requirement: Bun-managed updates MUST trust requested blocked lifecycle scripts across platform path styles

The agent update system SHALL recognize Bun global untrusted package output for requested managed packages regardless of whether Bun prints `node_modules` paths with POSIX or Windows separators.

#### Scenario: Trusting a requested scoped package from Windows Bun output

- GIVEN a Bun-managed agent package was requested by `quantex install`, `quantex update <agent>`, or `quantex update --all`
- AND `bun pm -g untrusted` reports that package using a Windows-style path such as `.\node_modules\@scope\name @1.2.3`
- WHEN the Bun install or update command exits successfully
- THEN Quantex trusts the requested package lifecycle script
- AND the agent update does not leave the requested package's required postinstall blocked because of path separator parsing

#### Scenario: Ignoring unrelated blocked packages

- GIVEN a Bun-managed install or update requested one or more package names
- AND `bun pm -g untrusted` reports additional packages that were not requested
- WHEN Quantex evaluates blocked lifecycle packages
- THEN Quantex only trusts blocked packages whose names match the requested package list

#### Scenario: Skipping untracked PATH detections during batch update

- GIVEN an agent binary is detected in `PATH`
- AND Quantex has no recorded install state for that agent
- WHEN the user runs `quantex update --all`
- THEN Quantex does not execute managed update or self-update operations for that agent
- AND the batch result explains that the agent was detected in `PATH` but is not tracked as a Quantex-managed install

#### Scenario: Adopting a safely identifiable existing install

- GIVEN an agent binary is detected in `PATH`
- AND Quantex has no recorded install state for that agent
- AND the current platform exposes exactly one supported unmanaged install method for that agent
- WHEN the user runs `quantex install <agent>` or `quantex ensure <agent>`
- THEN Quantex records that install method as the agent's install state without re-running an installer

#### Scenario: Adopting a safely identifiable existing managed install

- GIVEN an agent binary is detected in `PATH`
- AND Quantex has no recorded install state for that agent
- AND the detected binary path identifies a supported managed install source such as Bun global bin
- WHEN the user runs `quantex install <agent>` or `quantex ensure <agent>`
- THEN Quantex records that managed install method as the agent's install state without re-running an installer
- AND later lifecycle commands use that recorded managed install source

#### Scenario: Refusing to guess an ambiguous existing install source

- GIVEN an agent binary is detected in `PATH`
- AND Quantex has no recorded install state for that agent
- AND the current platform exposes multiple plausible install methods without an identifying binary path
- WHEN the user runs `quantex install <agent>` or `quantex ensure <agent>`
- THEN Quantex does not invent or overwrite install state for that agent
- AND the command explains that the install remains untracked

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

#### Scenario: Exec exposes machine-actionable preflight guidance

- GIVEN the user runs `quantex exec <agent>` with an agent that is not currently installed
- WHEN the command cannot continue without installation or an explicit install policy
- THEN Quantex keeps the existing error semantics
- AND exposes structured guidance that points to `ensure` and a rerun command with `--install if-missing`

### Requirement: Supported agent catalog entries MUST expose verified lifecycle metadata

The supported agent catalog SHALL expose verified canonical names, lookup aliases, install methods, package metadata, binary names, and self-update commands for each newly supported agent when upstream documentation provides them.

#### Scenario: Adding a newly supported agent with documented install and upgrade paths

- **WHEN** Quantex adds support for a newly documented CLI such as Kilo Code CLI
- **THEN** the catalog entry includes the verified package name, binary name, canonical homepage, and available install methods
- **AND** the entry exposes any verified self-update command through lifecycle surfaces such as `info`, `list`, and `update`

#### Scenario: Resolving a supported agent by canonical name or published alias

- **WHEN** a user refers to a supported agent by its canonical Quantex name or a published upstream alias
- **THEN** Quantex resolves the same catalog entry
- **AND** lifecycle commands operate on that agent without requiring a separate duplicate definition

