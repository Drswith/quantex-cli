# Project Memory Migration

This file tracks how legacy markdown documents in the repository root should be absorbed into the new project memory structure over time.

## Goals

- stop creating new ad hoc root markdown files
- preserve useful history without forcing a risky big-bang move
- give future agents a clear place to continue work

## Legacy mapping

| Existing file | Current role | Target home | Migration note |
|---|---|---|---|
| `TODO.md` | mixed backlog and status | `autonomy/queue.md` and `autonomy/tasks/` | Split into task-sized units with explicit done criteria |
| `HUMAN_AGENT_DUAL_MODE_CLI.md` | current design narrative | `openspec/specs/` plus `docs/adr/` | Keep as reference during transition; new changes should flow through OpenSpec and ADRs |
| `HUMAN_AGENT_DUAL_MODE_CLI_ADDENDUM.md` | design refinements | `openspec/changes/` or `docs/adr/` | Merge durable policy into ADRs, keep implementation detail in specs/changes |
| `HUMAN_AGENT_DUAL_MODE_CLI_IMPLEMENTATION_BACKLOG.md` | implementation backlog | `autonomy/queue.md` and `autonomy/tasks/` | Convert backlog bullets into executable tasks |
| `AUTO_UPGRADE_SCOPE.md` | subsystem scope and architecture | `openspec/specs/` plus `docs/adr/` | Treat current document as reference; future self-upgrade changes should use OpenSpec |
| `AUTO_UPGRADE_SCOPE_ADDENDUM.md` | refinement and non-goals | `docs/adr/` and `openspec/changes/` | Durable rules belong in ADRs; pending work belongs in change artifacts |
| `AUTO_UPGRADE_IMPLEMENTATION_BACKLOG.md` | implementation backlog | `autonomy/queue.md` and `autonomy/tasks/` | Normalize into task contracts |
| `skills/quantex-cli/references/troubleshooting.md` | troubleshooting knowledge | `docs/runbooks/` | Canonical runbook now exists at `docs/runbooks/quantex-troubleshooting.md`; keep the skill copy as a mirror until a later cleanup |

## Recommended order

1. Move backlog-shaped documents into `autonomy/`.
2. Establish current behavior contracts in `openspec/specs/`.
3. Extract durable design choices into ADRs.
4. Move recurring support knowledge into `docs/runbooks/`.
5. Leave legacy documents in place until the new canonical artifact is complete and linked.

## Working rule during migration

When touching a legacy document:

- decide whether the new information is a session summary, spec, ADR, runbook, postmortem, or task
- write the canonical update in the new structure first
- then trim or link the legacy document instead of expanding it further
