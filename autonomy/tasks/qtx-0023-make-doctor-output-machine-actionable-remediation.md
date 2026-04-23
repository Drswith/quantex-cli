---
id: qtx-0023
title: Make doctor output machine-actionable remediation
status: done
priority: high
area: surface
depends_on: []
human_review: required
checks:
  - bun run lint
  - bun run typecheck
docs_to_update:
  - openspec/specs/self-upgrade/spec.md
  - openspec/specs/agent-update/spec.md
  - docs/runbooks/quantex-troubleshooting.md
  - skills/quantex-cli/references/automation-playbook.md
---

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
