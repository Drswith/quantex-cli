# qtx-0023: Make doctor output machine-actionable remediation

> Migrated from `autonomy/tasks/qtx-0023-make-doctor-output-machine-actionable-remediation.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `high` |
| Area | surface |
| Depends on | - |
| Human review | `required` |
| Docs to update | openspec/specs/self-upgrade/spec.md, openspec/specs/agent-update/spec.md, docs/runbooks/quantex-troubleshooting.md, skills/quantex-cli/references/automation-playbook.md |

## Historical Task Contract

# Task: Make doctor output machine-actionable remediation

## Goal

Make `quantex doctor --json` expose remediation data that another agent can consume directly instead of inferring next steps from warning prose alone.

## Context

The first project-memory round proved that Quantex can store and evolve durable knowledge. The next round should prove that Quantex itself can expose machine-actionable lifecycle guidance so a future agent can decide what to do next with less human interpretation.

## Constraints

- Keep Quantex within its lifecycle CLI scope. Do not turn `doctor` into a workflow engine.
- Preserve current human-readable diagnosis value while strengthening the structured surface.

## Implementation Notes

- Relevant files: `src/commands/doctor.ts`, `src/commands/schema.ts`, `test/commands/doctor.test.ts`, `test/commands/schema.test.ts`
- Relevant commands: `quantex doctor --json`, `quantex schema doctor --json`
- Relevant specs: `openspec/specs/self-upgrade/spec.md`, `openspec/specs/agent-update/spec.md`

## Done When

- `doctor --json` issues include stable machine-actionable remediation fields.
- The `schema` command exposes the doctor contract explicitly.
- The troubleshooting and automation docs tell future agents to consume the structured doctor fields.

## Non-Goals

- Implementing automatic remediation execution inside `doctor`
- Expanding Quantex into a workflow orchestration surface
