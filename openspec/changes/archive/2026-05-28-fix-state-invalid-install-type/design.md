## Approach

Validate `installedAgents` during `readState()` using the same fail-closed contract as invalid JSON: if the file exists and contains invalid agent records, throw `StateFileError` and do not mutate the file.

## Validation rules

- `installedAgents` MUST be a plain object when present.
- Each entry MUST be a plain object with a string `agentName` matching the record key and an `installType` in the supported `InstallType` union.
- Optional fields (`packageName`, `binaryName`, etc.) are preserved when the entry is valid.

## Non-goals

- State migration for renamed agents (for example `deepseek` → `codewhale`).
- Full JSON-schema validation of every optional field.
