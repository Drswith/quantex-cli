## Why

Cargo support added a `cargo` boolean to `quantex doctor --json` under `data.installers`, but the doctor entry in `quantex schema doctor` still described only `brew`, `bun`, `npm`, and `winget`. With `additionalProperties: false`, any consumer validating doctor output against the published schema incorrectly rejects valid payloads.

## What Changes

- Extend the doctor `dataSchema.installers` contract to include `cargo` alongside the other managed installer flags.
- Lock the alignment in tests and sync the agent-update spec narrative used for diagnostics contracts.

## Impact

- Affected specs: `openspec/specs/agent-update/spec.md`.
- Affected code: `src/commands/schema.ts`, `test/commands/schema.test.ts`.
