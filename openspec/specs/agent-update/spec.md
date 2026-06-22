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

The agent update system SHALL choose the best available update strategy for a single agent based on the recorded install source and agent capabilities. When recorded install state exists, Quantex MUST NOT override that source by inferring a different managed installer from candidate install methods.

#### Scenario: Updating a managed agent

- GIVEN an agent was installed through a managed package source
- WHEN the user runs `quantex update <agent>`
- THEN Quantex selects the matching managed update path

#### Scenario: Updating an agent that cannot be managed automatically

- GIVEN an installed agent is not updateable through a managed path
- WHEN the user runs `quantex update <agent>`
- THEN Quantex provides a manual or explanatory hint instead of pretending the agent was upgraded

#### Scenario: Recorded unmanaged install is not reclassified as managed

- GIVEN an agent has recorded install state with install type `script` or `binary`
- AND the agent definition also declares a managed install method such as `pip`
- WHEN the user runs `quantex update <agent>`
- THEN Quantex does not select the managed install method from the definition as the update source
- AND it uses a self-update command when available or reports a manual/explanatory outcome
- AND it does not rewrite the recorded install state to the unrelated managed source

#### Scenario: Recorded managed install without a usable package name fails closed

- GIVEN an agent has recorded install state with a managed `installType`
- AND the recorded state does not include a non-empty `packageName`
- AND the agent catalog cannot infer a package name for that managed install type
- WHEN the user runs `quantex update <agent>`
- THEN Quantex does not run a self-update command as a substitute for the recorded managed source
- AND the update reports failure instead of success through an unrelated update path

#### Scenario: Managed install rolls back when state persistence fails

- GIVEN a managed install command succeeds for an agent
- WHEN Quantex cannot persist the installed-agent state immediately afterward
- THEN Quantex attempts to roll back the managed install
- AND the install operation surfaces the state persistence failure

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

Batch agent updates SHALL prioritize recorded actual install sources over candidate install methods declared for the agent. When recorded install state exists, Quantex MUST NOT group the agent under a different managed installer inferred only from candidate install methods.

#### Scenario: Updating all installed agents

- GIVEN multiple agents have recorded install state
- WHEN the user runs `quantex update --all`
- THEN Quantex groups update work by install type
- AND it groups work by the recorded actual install source where available
- AND it does not rely only on the agent definition's possible install methods

#### Scenario: Tracked unmanaged install is not batched through a candidate managed method

- GIVEN an agent has recorded install state with install type `script` or `binary`
- AND the agent definition also declares a managed install method such as `pip`
- WHEN the user runs `quantex update --all`
- THEN Quantex does not include that agent in a grouped managed update bucket for the candidate method
- AND the agent receives a self-update or manual/explanatory per-agent outcome instead

### Requirement: Managed batch updates MUST NOT claim success without installer package work

When Quantex performs a grouped managed batch update for an installer type, it SHALL NOT treat the batch path as successful when there are zero package names to pass to that installer after filtering invalid or empty names. When grouped managed batch update execution falls back to per-agent handling, Quantex SHALL execute fallback updates without creating same-process lifecycle lock contention that skips agents or reports them as locked.

#### Scenario: No-op batch path does not report blanket success

- GIVEN grouped managed update execution reaches `updateAgentsByType` for an installer type
- AND the deduplicated package list is empty because every supplied spec lacked a non-empty package name
- WHEN Quantex evaluates the batch managed update outcome
- THEN it returns batch failure for that path instead of success from an empty installer work list
- AND higher-level update execution can fall back to per-agent update handling so per-agent outcomes reflect actual work or failure

#### Scenario: Failed grouped update fallback avoids local lock contention

- GIVEN grouped managed update execution includes multiple agents for the same installer type
- AND the grouped installer path reports failure
- WHEN Quantex falls back to per-agent update handling
- THEN each fallback update is attempted without concurrent same-process lifecycle lock contention
- AND agents are not reported as locked solely because another fallback update in the same command is holding the lifecycle lock

### Requirement: Bun-managed updates MUST trust requested blocked lifecycle scripts across platform path styles

The agent update system SHALL recognize Bun global untrusted package output for requested managed packages regardless of whether Bun prints `node_modules` paths with POSIX or Windows separators. When the untrusted probe cannot be read after a successful Bun global install or update command, Quantex SHALL NOT report that managed operation as successful.

#### Scenario: Trusting a requested scoped package from Windows Bun output

- GIVEN a Bun-managed agent package was requested by `quantex install`, `quantex update <agent>`, or `quantex update --all`
- AND `bun pm -g untrusted` reports that package using a Windows-style path such as `.\node_modules\@scope\name @1.2.3`
- WHEN the Bun install or update command exits successfully
- THEN Quantex trusts the requested package lifecycle script
- AND the agent update does not leave the requested package's required postinstall blocked because of path separator parsing
- AND the managed operation is reported as successful only after trust completes successfully

#### Scenario: Ignoring unrelated blocked packages

- GIVEN a Bun-managed install or update requested one or more package names
- AND `bun pm -g untrusted` reports additional packages that were not requested
- WHEN Quantex evaluates blocked lifecycle packages
- THEN Quantex only trusts blocked packages whose names match the requested package list

#### Scenario: Failing closed when the untrusted probe is unavailable

- GIVEN a Bun-managed install or update requested one or more package names
- AND the Bun global install or update command exits successfully
- AND `bun pm -g untrusted` exits non-zero or cannot be executed
- WHEN Quantex evaluates blocked lifecycle scripts
- THEN Quantex reports the managed operation as failed
- AND it does not claim the install or update succeeded without completing trust verification

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

#### Scenario: Doctor schema documents every managed installer availability flag

- GIVEN the user runs `quantex schema doctor` in JSON mode
- WHEN Quantex returns the doctor command `dataSchema`
- THEN the `installers` object lists every managed installer key that `quantex doctor --json` may emit, including `cargo` and `pip`
- AND strict schema validation of real doctor JSON output does not fail solely because an installer flag is missing from the published schema

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

### Requirement: Cargo-managed agent lifecycle MUST use Cargo commands

Cargo-managed agent lifecycle operations SHALL install, update, batch update, uninstall, and diagnose agents through the Cargo installer when the recorded or selected install source is Cargo.

#### Scenario: Updating Cargo-managed agents

- **GIVEN** an agent has recorded install state with install type `cargo`
- **WHEN** the user runs `quantex update <agent>` or `quantex update --all`
- **THEN** Quantex selects the Cargo managed update path
- **AND** it runs Cargo with the recorded crate name and `--force` instead of guessing another package-manager source
- **AND** it preserves any recorded Cargo install arguments such as `--locked`

#### Scenario: Grouping Cargo-managed updates

- **GIVEN** multiple installed agents have recorded Cargo install state
- **WHEN** the user runs `quantex update --all`
- **THEN** Quantex groups those updates by the Cargo installer
- **AND** it executes Cargo-managed batch update work without mixing the crates into npm, Bun, Homebrew, or winget groups

#### Scenario: Reporting Cargo installer availability

- **GIVEN** the user runs `quantex capabilities` or `quantex doctor`
- **WHEN** Quantex reports managed installer availability
- **THEN** the output includes Cargo availability alongside Bun, npm, Homebrew, and winget

### Requirement: uv-managed agent lifecycle MUST use uv tool commands

uv-managed agent lifecycle operations SHALL install, update, batch update, uninstall, diagnose, and report agents through the uv installer when the recorded or selected install source is uv.

#### Scenario: Installing uv-managed agents

- **GIVEN** an agent exposes a uv managed install method
- **WHEN** the user runs `quantex install <agent>` or `quantex ensure <agent>` and that uv method is selected
- **THEN** Quantex runs `uv tool install` with the resolved package name
- **AND** it preserves any package-specific install arguments declared by the agent definition
- **AND** it records the installed state with install type `uv`, package name, and package install arguments

#### Scenario: Updating uv-managed agents

- **GIVEN** an agent has recorded install state with install type `uv`
- **WHEN** the user runs `quantex update <agent>` or `quantex update --all`
- **THEN** Quantex selects the uv managed update path
- **AND** it runs `uv tool upgrade` with the recorded package name instead of guessing another package-manager source
- **AND** it preserves any recorded package-specific install arguments

#### Scenario: Grouping uv-managed updates

- **GIVEN** multiple installed agents have recorded uv install state
- **WHEN** the user runs `quantex update --all`
- **THEN** Quantex groups those updates by the uv installer
- **AND** it executes uv-managed batch update work without mixing the tool packages into Bun, npm, Homebrew, Cargo, pip, or winget groups

#### Scenario: Uninstalling uv-managed agents

- **GIVEN** an agent has recorded install state with install type `uv`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex runs `uv tool uninstall` with the recorded package name
- **AND** it removes the Quantex installed-agent state only after uv reports success

#### Scenario: Reporting uv installer availability

- **GIVEN** the user runs `quantex capabilities` or `quantex doctor`
- **WHEN** Quantex reports managed installer availability
- **THEN** the output includes uv availability alongside Bun, npm, Homebrew, Cargo, pip, and winget

#### Scenario: Doctor schema documents uv installer availability

- **GIVEN** the user runs `quantex schema doctor` in JSON mode
- **WHEN** Quantex returns the doctor command `dataSchema`
- **THEN** the `installers` object lists the `uv` installer key that `quantex doctor --json` may emit
- **AND** strict schema validation of real doctor JSON output does not fail solely because the uv installer flag is missing from the published schema

### Requirement: mise-managed agent lifecycle MUST use mise commands

mise-managed agent lifecycle operations SHALL install, update, batch update, uninstall, diagnose, and report agents through the mise installer when the recorded or selected install source is mise.

#### Scenario: Installing mise-managed agents

- **GIVEN** an agent exposes a mise managed install method
- **WHEN** the user runs `quantex install <agent>` or `quantex ensure <agent>` and that mise method is selected
- **THEN** Quantex runs `mise use --global` with the resolved mise tool reference
- **AND** it records the installed state with install type `mise` and the mise tool reference

#### Scenario: Updating mise-managed agents

- **GIVEN** an agent has recorded install state with install type `mise`
- **WHEN** the user runs `quantex update <agent>`
- **THEN** Quantex selects the mise managed update path
- **AND** it runs `mise use --global --force` with the recorded mise tool reference instead of guessing another package-manager source

#### Scenario: Grouping mise-managed updates

- **GIVEN** multiple installed agents have recorded mise install state
- **WHEN** the user runs `quantex update --all`
- **THEN** Quantex groups those updates by the mise installer
- **AND** it executes mise-managed batch update work without mixing the tool references into Bun, npm, Homebrew, Cargo, pip, uv, or winget groups

#### Scenario: Uninstalling mise-managed agents

- **GIVEN** an agent has recorded install state with install type `mise`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex runs `mise unuse --global` with the recorded mise tool reference
- **AND** it removes the Quantex installed-agent state only after mise reports success

#### Scenario: Reporting mise installer availability

- **WHEN** Quantex reports managed installer availability
- **THEN** the output includes mise availability alongside Bun, npm, Homebrew, Cargo, pip, uv, and winget

#### Scenario: Doctor schema documents mise installer availability

- **WHEN** a user or agent reads `quantex schema doctor`
- **THEN** the `installers` object lists the `mise` installer key that `quantex doctor --json` may emit
- **AND** strict schema validation of real doctor JSON output does not fail solely because the mise installer flag is missing from the published schema

### Requirement: Managed lifecycle cancellation MUST terminate Windows wrapper process trees before wrapper fallback kill

When Quantex cancels a managed lifecycle installer on Windows and a child process identifier is available, it SHALL attempt process-tree termination before directly killing the wrapper process. Quantex MUST preserve sticky cancellation semantics if process-tree termination is unavailable, denied, or races with child exit.

#### Scenario: Windows wrapper child owns a long-running installer descendant

- **GIVEN** Quantex is running a managed installer through a Windows wrapper process
- **AND** the wrapper has started a long-running installer descendant
- **WHEN** the managed installer operation is cancelled by signal or timeout
- **THEN** Quantex attempts process-tree termination for the wrapper process identifier before direct wrapper termination
- **AND** the installer descendant does not continue producing installer progress after Quantex returns the cancelled result
- **AND** Quantex does not persist normal installed-agent state for the cancelled operation

#### Scenario: Batch install does not continue after timeout cancellation

- **GIVEN** the user runs `quantex install <slow-agent> <fast-agent> --timeout <duration>`
- **AND** the first agent's install work exceeds the configured timeout and late-completion grace window
- **WHEN** Quantex emits a timeout cancellation result for the command
- **THEN** it does not install or persist state for `<fast-agent>`
- **AND** it does not persist normal installed-agent state for the cancelled `<slow-agent>` operation

#### Scenario: Batch update does not continue after timeout cancellation

- **GIVEN** the user runs `quantex update --all --timeout <duration>`
- **AND** an early update item exceeds the configured timeout and late-completion grace window
- **WHEN** Quantex emits a timeout cancellation result for the command
- **THEN** it does not perform later update work for remaining agents in the same command
- **AND** it does not persist normal installed-agent state for the cancelled update operation

### Requirement: Uninstall MUST clear tracked unmanaged install state

When an agent is recorded with install type `script` or `binary`, Quantex SHALL remove the installed-agent state entry on uninstall even though no managed package uninstall command exists.

#### Scenario: Uninstalling a tracked script install

- **GIVEN** an agent has recorded install state with install type `script`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex removes the installed-agent state entry
- **AND** the uninstall command reports success
- **AND** Quantex does not require a managed package-manager uninstall for that install type

#### Scenario: Uninstalling a tracked binary install

- **GIVEN** an agent has recorded install state with install type `binary`
- **WHEN** the user runs `quantex uninstall <agent>`
- **THEN** Quantex removes the installed-agent state entry
- **AND** the uninstall command reports success

### Requirement: Exec and shortcut install flows MUST honor global timeout during managed install

When `quantex exec` or shortcut `quantex <agent>` runs with `--timeout` and must install a missing agent before launch, Quantex SHALL apply the configured timeout to the install phase. After the deadline fires, Quantex SHALL wait up to `min(timeoutMs, 250)` for managed install work to finish before cancelling managed installer subprocesses.

#### Scenario: Missing agent install times out before spawn

- **GIVEN** the target agent is not currently installed
- **AND** the user runs `quantex exec <agent> --install if-missing --timeout <duration>` or shortcut `quantex <agent> --timeout <duration>`
- **WHEN** managed install work exceeds the configured timeout and the late-completion grace window
- **THEN** Quantex cancels the managed installer subprocesses
- **AND** it returns a timeout result with exit code `10`
- **AND** it does not continue to spawn the agent binary after the install deadline expires

#### Scenario: Successful install after timeout deadline is reported as success

- **GIVEN** the target agent is not currently installed
- **AND** the user runs `quantex exec <agent> --install if-missing --timeout <duration>` or shortcut `quantex <agent> --timeout <duration>`
- **AND** cancellation handlers would abort the install when invoked
- **WHEN** managed install work completes successfully within the late-completion grace window after the timeout deadline fired
- **THEN** Quantex reports install success
- **AND** it does not cancel managed install work before the grace window ends
- **AND** it continues to spawn the agent binary when launch is requested

### Requirement: Exec and shortcut spawn flows MUST honor global timeout during agent execution

When `quantex exec` or shortcut `quantex <agent>` runs with `--timeout` and launches an installed agent binary, Quantex SHALL apply the configured timeout to the spawned agent process. After the deadline fires, Quantex SHALL wait up to `min(timeoutMs, 250)` for the process to exit before cancelling it.

#### Scenario: Spawned agent exceeds timeout and grace window

- **GIVEN** the target agent is installed
- **AND** the user runs `quantex exec <agent> --timeout <duration>` or shortcut `quantex <agent> --timeout <duration>`
- **WHEN** the spawned agent process does not exit within the configured timeout and late-completion grace window
- **THEN** Quantex cancels the spawned agent process
- **AND** it returns a timeout result with exit code `10`

#### Scenario: Successful spawn exit after timeout deadline returns agent exit code

- **GIVEN** the target agent is installed
- **AND** the user runs `quantex exec <agent> --timeout <duration>` or shortcut `quantex <agent> --timeout <duration>`
- **WHEN** the spawned agent process exits successfully within the late-completion grace window after the timeout deadline fired
- **THEN** Quantex returns the agent process exit code
- **AND** it does not cancel the spawned agent process before the grace window ends

