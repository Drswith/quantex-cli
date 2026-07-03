# agent-uninstall Specification

## Purpose
Define the observable behavior and structured error contract for uninstalling agent tooling managed by Quantex.
## Requirements
### Requirement: Uninstall MUST distinguish unmanaged targets from execution failures

Quantex SHALL report a resolved-but-unmanaged uninstall target with a stable structured error distinct from a failed managed uninstall attempt.

#### Scenario: Uninstalling a resolved agent without managed state

- GIVEN a supported agent resolves from the uninstall input
- AND Quantex has no managed installed-state record for that agent
- WHEN the user runs `qtx uninstall <agent>`
- THEN Quantex returns `{ ok: false, error: { code: "UNINSTALL_UNMANAGED", ... } }` in structured output mode
- AND the human output explains that Quantex cannot auto-uninstall the agent because it is unmanaged or untracked
- AND the operation does not invoke package-manager uninstall execution
- AND the message points the user to `qtx inspect <agent>` for details

#### Scenario: Managed uninstall execution still fails generically

- GIVEN a supported agent resolves from the uninstall input
- AND Quantex has a managed installed-state record for that agent
- WHEN managed uninstall execution fails
- THEN Quantex keeps returning `UNINSTALL_FAILED`
- AND the result remains distinguishable from `UNINSTALL_UNMANAGED`

