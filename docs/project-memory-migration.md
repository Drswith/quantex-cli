# Project Memory Migration

This file tracks how legacy markdown documents in the repository root should be absorbed into the new project memory structure over time.

## Goals

- stop creating new ad hoc root markdown files
- preserve useful history without forcing a risky big-bang move
- give future agents a clear place to continue work

## Legacy mapping

| Existing file | Current role | Target home | Migration note |
|---|---|---|---|
| `TODO.md` | mixed backlog and status | `autonomy/queue.md` and `autonomy/tasks/` | Converted into task contracts on 2026-04-23 and archived at `docs/archive/legacy-root-notes/TODO.md` |
| `HUMAN_AGENT_DUAL_MODE_CLI.md` | current design narrative | `openspec/specs/` plus `docs/adr/` | Archived at `docs/archive/legacy-root-notes/HUMAN_AGENT_DUAL_MODE_CLI.md`; new changes should flow through OpenSpec and ADRs |
| `HUMAN_AGENT_DUAL_MODE_CLI_ADDENDUM.md` | design refinements | `openspec/changes/` or `docs/adr/` | Archived at `docs/archive/legacy-root-notes/HUMAN_AGENT_DUAL_MODE_CLI_ADDENDUM.md`; durable policy belongs in ADRs |
| `HUMAN_AGENT_DUAL_MODE_CLI_IMPLEMENTATION_BACKLOG.md` | implementation backlog | `autonomy/queue.md` and `autonomy/tasks/` | Converted into task contracts on 2026-04-23 and archived at `docs/archive/legacy-root-notes/HUMAN_AGENT_DUAL_MODE_CLI_IMPLEMENTATION_BACKLOG.md` |
| `AUTO_UPGRADE_SCOPE.md` | subsystem scope and architecture | `openspec/specs/` plus `docs/adr/` | Consolidated on 2026-04-23; legacy root file removed after migration |
| `AUTO_UPGRADE_SCOPE_ADDENDUM.md` | refinement and non-goals | `docs/adr/` and `openspec/changes/` | Consolidated on 2026-04-23; legacy root file removed after migration |
| `AUTO_UPGRADE_IMPLEMENTATION_BACKLOG.md` | implementation backlog | `autonomy/queue.md` and `autonomy/tasks/` | Normalized into task contracts on 2026-04-23; legacy root file removed after migration |
| `skills/quantex-cli/references/troubleshooting.md` | troubleshooting knowledge | `docs/runbooks/` | Canonical runbook now exists at `docs/runbooks/quantex-troubleshooting.md`; keep the skill copy as a mirror until a later cleanup |

## Recommended order

1. Move backlog-shaped documents into `autonomy/`.
2. Establish current behavior contracts in `openspec/specs/`.
3. Extract durable design choices into ADRs.
4. Move recurring support knowledge into `docs/runbooks/`.
5. Archive or remove legacy documents once the new canonical artifact is complete and linked.

## Working rule during migration

When touching a legacy document:

- decide whether the new information is a session summary, spec, ADR, runbook, postmortem, or task
- write the canonical update in the new structure first
- then trim or link the legacy document instead of expanding it further
