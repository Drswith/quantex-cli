## Why

The supported agent catalog still exposes a few stale or inconsistent public names and lookup aliases for Kilo, Qoder, and Qwen. Because these identifiers are user-visible and machine-consumable lifecycle metadata, Quantex needs to align them with the current upstream naming we want to support.

## What Changes

- Rename the Kilo display name from `Kilo Code CLI` to `Kilo CLI`.
- Add `qodercli` as a supported lookup alias for the canonical `qoder` agent entry.
- Remove the legacy `qwen-code` lookup alias so Qwen resolves only through the canonical `qwen` slug.
- Update tests and product-facing README tables to match the corrected catalog names.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-catalog`: Update the supported naming and lookup-alias contract for Kilo, Qoder, and Qwen catalog entries.

## Impact

- Affected code: `src/agents/definitions/`, agent lookup tests, and root README tables.
- Affected contract: `openspec/specs/agent-catalog/spec.md`.
