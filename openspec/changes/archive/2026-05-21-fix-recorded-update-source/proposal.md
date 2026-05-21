## Why

Tracked agents can currently be planned through a different managed installer when their recorded install source is unmanaged but their catalog entry also advertises a managed candidate method. This can report a successful update for a package-manager install that is not the binary Quantex recorded, and fallback execution can overwrite durable state with the wrong source.

## What Changes

- Preserve recorded non-managed install sources during update planning instead of inferring a managed installer from candidate install methods.
- Keep managed inference for untracked single-agent updates where no recorded state exists.
- Add regression coverage for a tracked script install whose agent definition also supports pip.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-update`: update strategy selection must not override a recorded install source with a different candidate package-manager method.

## Impact

- Affected code: `src/agent-update/providers.ts`, update planning callers, and update command tests.
- User impact: tracked script/binary installs avoid false managed-update success and avoid state drift during fallback handling.
- Dependencies: none.
