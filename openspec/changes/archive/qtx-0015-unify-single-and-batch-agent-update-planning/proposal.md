# qtx-0015: Unify single-agent and batch agent update planning

> Migrated from `autonomy/tasks/qtx-0015-unify-single-and-batch-agent-update-planning.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `medium` |
| Area | agents |
| Depends on | qtx-0013, qtx-0014 |
| Human review | `required` |
| Docs to update | openspec/specs/agent-update/spec.md |

## Historical Task Contract

# Task: Unify single-agent and batch agent update planning

## Goal

Make `update <agent>` and `update --all` use the same strategy selection and planning model.

## Context

The legacy backlog explicitly calls for a shared planning layer so single-agent and batch update behavior do not drift.

## Constraints

- Preserve state-first update source selection.
- Keep batch output explainable for each agent.

## Implementation Notes

- Share provider selection and plan modeling between single and batch updates.
- Surface chosen strategy layers in batch output where helpful.

## Done When

- Single-agent and batch updates use the same strategy rules.
- Batch planning can explain how each agent will be updated.

## Non-Goals

- Expanding Quantex into a workflow orchestration system.
