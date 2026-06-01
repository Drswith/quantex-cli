## Why

Implementation requested work-intake classification: this change modifies observable Bun-managed install and update success reporting, so it requires OpenSpec before file edits.

When `bun add -g` or `bun update -g` succeeds but `bun pm -g untrusted` cannot be read, Quantex currently treats the lifecycle as successful without running `bun pm -g trust`. That can leave blocked postinstall packages unusable while reporting install or update success.

## What Changes

- Fail closed when the Bun global untrusted probe fails after a successful global install or update command.
- Keep treating an empty successful untrusted listing as success with no additional trust work.
- Add regression coverage for non-zero untrusted probe exit codes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: Bun-managed install and update flows must not report success when required blocked-lifecycle trust cannot be verified or completed.

## Impact

- Affected code: `src/package-manager/bun.ts` and `test/package-manager/bun.test.ts`.
- Affected specs: `openspec/specs/agent-update/spec.md` through a change delta.
- No structured output, schema version, command catalog, or dependency changes are intended.
