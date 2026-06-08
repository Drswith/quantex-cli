## Context

`readState()` now throws `StateFileError` for corrupt JSON, invalid `installedAgents`, and other unsafe persisted-state shapes. Commands catch `ResourceLockError` locally but rethrow other errors, and `executeCommandWithRuntime()` has no top-level translation for state read failures.

## Goals / Non-Goals

- Goals: return structured command failures for state read errors; preserve fail-closed reads; keep the fix narrow and centralized.
- Non-goals: auto-repair or delete corrupt `state.json`; change state normalization rules; add new recovery commands.

## Decisions

- Add `STATE_READ_ERROR` to the stable CLI error catalog with exit code `12`.
- Add `createStateReadError()` beside the existing resource-lock helper.
- Catch `StateFileError` at the outer edge of `executeCommandWithRuntime()` and in the shortcut `quantex <agent>` path before `process.exit()`.
- Include `stateFilePath` in structured error details for remediation.

## Risks / Trade-offs

- Commands that intentionally let `StateFileError` bubble to callers outside the CLI runtime are unaffected; only CLI entry paths are normalized.
