## MODIFIED Requirements

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
