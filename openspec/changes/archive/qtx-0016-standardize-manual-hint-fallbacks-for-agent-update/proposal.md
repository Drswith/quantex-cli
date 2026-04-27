# qtx-0016: Standardize manual-hint fallbacks for agent update

> Migrated from `autonomy/tasks/qtx-0016-standardize-manual-hint-fallbacks-for-agent-update.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `low` |
| Area | agents |
| Depends on | qtx-0015 |
| Human review | `required` |
| Docs to update | openspec/specs/agent-update/spec.md |

## Historical Task Contract

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
