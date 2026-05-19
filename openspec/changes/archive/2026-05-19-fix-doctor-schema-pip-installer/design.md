## Context

The pip installer had already become part of the doctor JSON payload, but the published `quantex schema doctor` contract still omitted the `installers.pip` flag while using strict `additionalProperties: false` validation.

## Decision

Keep the fix scoped to schema parity:

- add `pip` to the doctor schema installer properties and required list
- keep runtime doctor output unchanged
- extend schema tests so the published contract tracks every managed installer flag

## Risk

The main risk was widening the schema beyond actual doctor output. The implementation avoids that by only adding the installer key already emitted by `quantex doctor --json`.
