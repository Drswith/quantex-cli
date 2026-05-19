## Why

Pip was added as a first-class managed installer and `quantex doctor --json` emits `data.installers.pip`, but the doctor entry in `quantex schema doctor` did not declare `pip` under `installers`. With `additionalProperties: false`, strict validators reject otherwise valid doctor JSON.

## What Changes

- Add `pip` to `dataSchema.installers.properties` and to `installers.required` in the doctor schema catalog entry.
- Extend the agent-update spec scenario for doctor schema completeness and assert `pip` in schema tests.

## Impact

- Affected specs: `openspec/specs/agent-update/spec.md`.
- Affected code: `src/commands/schema.ts`, `test/commands/schema.test.ts`.
