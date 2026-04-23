---
id: qtx-0016
title: Standardize manual-hint fallbacks for agent update
status: done
priority: low
area: agents
depends_on:
  - qtx-0015
human_review: required
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/agent-update/spec.md
---

# Task: Standardize manual-hint fallbacks for agent update

## Goal

Provide stable, reusable fallback guidance when agents cannot be updated automatically.

## Context

The legacy backlog treats `manual-hint` as a first-class update layer rather than a scattered last-resort message.

## Constraints

- Keep hints accurate to the detected install source.
- Avoid claiming success when only guidance was shown.

## Implementation Notes

- Consolidate manual-hint templates and fallback rules.
- Cover unsupported, script, source, and unknown update cases.

## Done When

- Manual fallback behavior is explicit and consistent across single and batch update flows.
- Tests cover representative fallback cases.

## Non-Goals

- Implementing automatic support for every currently manual update path.
