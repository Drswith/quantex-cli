---
id: qtx-0015
title: Unify single-agent and batch agent update planning
status: planned
priority: medium
area: agents
depends_on:
  - qtx-0013
  - qtx-0014
human_review: required
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/agent-update/spec.md
---

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
