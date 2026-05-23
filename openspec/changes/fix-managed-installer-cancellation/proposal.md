## Why

`qtx install vtcode` can return control to Windows PowerShell after `Ctrl+C` while the underlying Cargo installer continues writing to the same console and can later be reported as a successful install. This is observable lifecycle behavior, so the fix requires an OpenSpec change before implementation.

## What Changes

- Make CLI signal and timeout cancellation wait for registered managed-process cleanup before returning a final result.
- Treat cancellation as sticky for managed installer commands so a child process that exits `0` after cancellation is not reported as normal success.
- Terminate managed child process trees on Windows with a bounded `taskkill /T /F` fallback when a child PID is available.
- Add focused regression coverage for cancellation cleanup and success-after-cancel behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: Clarify managed lifecycle installer cancellation semantics for install, update, batch update, and uninstall paths.

## Impact

- Affected code: `src/cli-context.ts`, `src/command-runtime.ts`, and `src/utils/child-process.ts`.
- Affected tests: `test/command-runtime.test.ts` and `test/utils/child-process.test.ts`.
- No new runtime dependency is introduced; Windows process-tree termination uses the platform-provided `taskkill.exe` when needed.
