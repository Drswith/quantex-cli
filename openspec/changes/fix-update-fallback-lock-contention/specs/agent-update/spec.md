## MODIFIED Requirements

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
