## Context

`uninstallCommand()` resolves an agent, then calls `uninstallAgent()`. `uninstallAgent()` returns `false` both when no managed installed-state record exists and when a managed uninstall command fails. The command layer therefore cannot distinguish an external installer from a failed managed uninstall.

`inspectCommand()` already exposes the same user-facing distinction through `inspection.lifecycle` and `capabilities.canAutoUninstall`, but using full inspection for uninstall preflight would introduce PATH and network work into a command that only needs to know whether Quantex has a managed state record.

## Goals / Non-Goals

**Goals:**

- Give unmanaged or untracked uninstall targets a stable structured error distinct from managed uninstall execution failures.
- Keep human output actionable and direct users to inspect details without guessing platform-specific cleanup state.
- Let lifecycle commands resolve a displayed agent name such as `Qoder CLI`.
- Preserve existing successful managed uninstall behavior.

**Non-Goals:**

- Automatically remove files installed by external installers.
- Add platform-specific manual cleanup automation.
- Change install, update, inspect, or run behavior beyond shared agent lookup.
- Change command catalog shape or global exit-code mapping.

## Decisions

- `uninstallCommand()` will read `getInstalledAgentState(agent.name)` before non-dry-run uninstall execution. If the record is missing, it returns `UNINSTALL_UNMANAGED` and does not call `uninstallAgent()`.
- Dry-run uninstall for an untracked agent will use the same unmanaged error classification, because the operation still cannot be planned as an auto-uninstall.
- The unmanaged error details will include the canonical agent name, display name, lifecycle `unmanaged`, `canAutoUninstall: false`, and the original input.
- `getAgentByLookupName()` will match a normalized display name after canonical names and aliases. Matching will be case-insensitive for display names only, preserving exact slug and alias behavior.

## Risks / Trade-offs

- [Risk] Display names are human-facing and may change. -> Acceptable for command ergonomics because canonical names and aliases remain the stable machine contract.
- [Risk] Missing managed state can also mean stale state after manual deletion. -> Still an unmanaged/untracked uninstall target from Quantex's perspective; `inspect` remains the detailed diagnostic path.
