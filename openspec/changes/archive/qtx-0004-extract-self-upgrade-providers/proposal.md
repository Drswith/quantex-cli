# qtx-0004: Extract self-upgrade provider modules

> Migrated from `autonomy/tasks/qtx-0004-extract-self-upgrade-providers.md` on 2026-04-27. This is completed task history preserved as an archived OpenSpec change.

## Metadata

| Field | Value |
|---|---|
| Status | `done` |
| Priority | `high` |
| Area | self |
| Depends on | - |
| Human review | `required` |
| Docs to update | openspec/specs/self-upgrade/spec.md, docs/adr/0002-keep-self-upgrade-and-agent-update-separate.md |

## Historical Task Contract

# Task: Extract self-upgrade provider modules

## Goal

Move Quantex self-upgrade branching logic into provider modules with a registry-driven dispatch path.

## Context

The legacy auto-upgrade design treats self-upgrade as a provider-based subsystem, but the implementation still needs that boundary made explicit.

## Constraints

- Preserve existing upgrade behavior.
- Do not collapse self-upgrade and agent update into a shared business abstraction.

## Implementation Notes

- Introduce `src/self/providers/`.
- Make the command/service path do `find + delegate`.
- Keep user-facing output stable.

## Done When

- Self-upgrade provider modules exist for the supported self install sources.
- Command-layer branching is replaced by provider dispatch.

## Non-Goals

- Adding checksum, lock, or manifest behavior in the same change.
