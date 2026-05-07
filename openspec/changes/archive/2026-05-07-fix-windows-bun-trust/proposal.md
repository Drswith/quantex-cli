## Why

Implementation requested work-intake classification: this change modifies observable agent update behavior for Bun-managed installs on Windows, so it requires OpenSpec before file edits.

When Bun blocks a global package lifecycle script on Windows, `bun pm -g untrusted` prints package paths with backslashes. Quantex only recognizes POSIX-style paths today, so `qtx update --all` can report a Bun-managed agent as updated while leaving its required postinstall blocked and its binary unusable.

## What Changes

- Teach Bun-managed install and update flows to recognize blocked lifecycle package paths emitted with either POSIX or Windows separators.
- Ensure requested Bun-managed packages whose lifecycle scripts were blocked are trusted after a successful global install or update.
- Add regression coverage for Windows-style `bun pm -g untrusted` output.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: Managed Bun update behavior must complete required blocked lifecycle trust for requested packages regardless of platform path separator style.

## Impact

- Affected code: `src/package-manager/bun.ts` and related tests.
- Affected specs: `openspec/specs/agent-update/spec.md` through a change delta.
- No structured output, schema version, command catalog, or dependency changes are intended.
