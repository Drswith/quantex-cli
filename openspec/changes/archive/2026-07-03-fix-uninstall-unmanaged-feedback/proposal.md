## Why

`qtx uninstall qodercli` currently collapses an unmanaged external installation into the generic `UNINSTALL_FAILED` path even though `inspect` can report that Quantex cannot auto-uninstall it. Users also see `Qoder CLI` in list output but cannot use that displayed name as an uninstall target.

## What Changes

- Short-circuit `uninstall` before invoking package-manager removal when Quantex has no managed installed-state record for a resolved agent.
- Return a dedicated structured error code for unmanaged or untracked uninstall targets, with a human message that explains the blocker and points users to `qtx inspect <agent>`.
- Allow agent lookup by display name in addition to canonical name and lookup aliases, so displayed agent names remain valid lifecycle targets.
- Keep the existing `UNINSTALL_FAILED` code for genuine managed uninstall attempts that fail after Quantex has a managed installed-state record.

## Capabilities

### New Capabilities

- `agent-uninstall`: uninstall command behavior, structured errors, and managed-state preflight semantics.

### Modified Capabilities

- `agent-catalog`: stable agent identification includes display-name lookup for lifecycle command resolution.

## Impact

- Affected code: `src/commands/uninstall.ts`, `src/agents/index.ts`, related command and registry tests.
- Structured output gains a distinct `UNINSTALL_UNMANAGED` error code for callers that need to branch on unmanaged uninstall targets.
- No dependency, package, or release workflow changes.
