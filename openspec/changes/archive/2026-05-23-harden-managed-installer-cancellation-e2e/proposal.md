## Why

#237 was initially fixed by making managed installer cancellation sticky and joined, then archived after #288 merged. Follow-up e2e work found a Windows-specific ordering risk: when Quantex launches a managed installer through a `.cmd`-style wrapper, directly killing the wrapper before `taskkill /T /F` can orphan the real installer process. That can recreate the user-visible symptom where Quantex returns while Cargo continues writing to the console.

This follow-up change keeps the archived cancellation contract intact while adding an isolated e2e reproduction and tightening the Windows process-tree termination order.

## What Changes

- On Windows, attempt process-tree termination with `taskkill /T /F` before direct child termination when a managed child PID is available.
- Add an isolated e2e regression that runs the real Quantex runtime path against a fake Cargo installer under a sandboxed home/profile/PATH.
- Assert the cancelled install returns a timeout result quickly, does not render success, does not persist installed-agent state, and terminates the fake installer before it can complete.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: Reinforce the existing managed lifecycle cancellation requirement with an e2e scenario for Windows wrapper process-tree cleanup.

## Impact

- Affected code: `src/utils/child-process.ts`.
- Affected tests: `test/managed-installer-cancellation.e2e.test.ts` and `scripts/managed-installer-cancellation-smoke.ts`.
- No new runtime dependency is introduced; Windows process-tree termination continues to use the platform-provided `taskkill.exe`.
