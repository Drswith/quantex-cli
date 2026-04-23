---
id: qtx-0026
title: Make exec surface machine-actionable install guidance
status: done
priority: high
area: surface
depends_on: []
human_review: required
checks:
  - bun run lint
  - bun run typecheck
docs_to_update:
  - openspec/specs/agent-update/spec.md
  - skills/quantex-cli/references/command-recipes.md
---

# Task: Make exec surface machine-actionable install guidance

## Goal

Make `quantex exec` expose machine-actionable preflight guidance when launch cannot proceed because installation is missing or an install policy blocks the next step.

## Context

The second autonomy round has already upgraded `doctor` and `resolve` into more useful machine-readable contracts. `exec` is the next high-value runtime entry point: future agents need structured next steps when execution cannot even start.

## Constraints

- Keep successful `exec` launches as passthrough behavior.
- Strengthen only the preflight and failure paths that Quantex itself owns.

## Implementation Notes

- Relevant files: `src/commands/run.ts`, `src/commands/schema.ts`, `test/commands/run.test.ts`, `test/commands/schema.test.ts`
- Relevant commands: `quantex exec <agent> --install never -- ...`, `quantex exec <agent> --json`
- Relevant specs or ADRs: `openspec/specs/agent-update/spec.md`

## Done When

- `exec` emits structured preflight guidance when launch is blocked by missing installation or policy.
- The `schema` catalog explicitly documents the `exec` preflight contract.
- Tests cover the new JSON guidance paths.

## Non-Goals

- Replacing passthrough child-process execution with a fully structured runtime protocol
- Expanding Quantex into a workflow orchestrator
