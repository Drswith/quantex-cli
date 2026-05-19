## MODIFIED Requirements

### Requirement: Managed batch updates MUST NOT claim success without installer package work

When Quantex performs a grouped managed batch update for an installer type, it SHALL NOT treat the batch path as successful when there are zero package names to pass to that installer after filtering invalid or empty names. Quantex SHALL NOT report an individual agent as updated by a grouped managed update unless that agent contributed package work to the grouped installer invocation.

#### Scenario: No-op batch path does not report blanket success

- GIVEN grouped managed update execution reaches `updateAgentsByType` for an installer type
- AND the deduplicated package list is empty because every supplied spec lacked a non-empty package name
- WHEN Quantex evaluates the batch managed update outcome
- THEN it returns batch failure for that path instead of success from an empty installer work list
- AND higher-level update execution can fall back to per-agent update handling so per-agent outcomes reflect actual work or failure

#### Scenario: Package-less entries in a mixed batch fall back individually

- GIVEN grouped managed update planning finds multiple agents for the same installer type
- AND at least one agent has a non-empty package name
- AND at least one agent lacks a package name for that installer update
- WHEN Quantex executes the grouped managed update
- THEN the grouped installer invocation includes only agents with package work
- AND package-less agents are handled through per-agent update fallback
- AND package-less agents are not reported as updated solely because the grouped installer invocation succeeded for other packages
