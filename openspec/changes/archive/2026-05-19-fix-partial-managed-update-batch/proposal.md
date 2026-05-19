## Why

Grouped managed updates can currently report an agent as updated even when that agent did not contribute any package name to the installer command. In a mixed bucket, a successful installer update for other packages can mask that a package-less agent received no update work.

## What Changes

- Split package-less grouped managed update entries out of the batch path before execution.
- Let package-less entries fall back to the existing per-agent update handling so their result reflects actual work or failure.
- Add regression coverage for mixed managed buckets where only some agents have package specs.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: Tightens managed batch update reporting so partial package-less buckets cannot claim blanket success.

## Impact

- Affected code: `src/services/update.ts`, `src/commands/update.ts` execution planning through existing interfaces.
- Affected tests: update command regression tests.
- No new dependencies or external systems.
