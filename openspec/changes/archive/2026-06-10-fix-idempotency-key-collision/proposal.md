## Why

`--idempotency-key` filenames are derived by replacing non-alphanumeric characters with underscores. Distinct client keys such as `job-1/install/codex` and `job-1_install_codex` collide on disk, causing one agent's successful install result to be replayed for a different request.

## What Changes

- Derive idempotency record filenames from a collision-resistant digest of the full client key.
- Add regression coverage proving distinct keys that previously sanitized to the same filename are stored and replayed independently.
- Validate replay still compares action and continues to persist only successful results.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `cli-idempotency`: require collision-safe on-disk key mapping and independent replay for distinct client keys.

## Impact

- Affected code: `src/idempotency.ts`, `test/idempotency.test.ts`.
- No CLI flags, schema version, or command catalog changes.
