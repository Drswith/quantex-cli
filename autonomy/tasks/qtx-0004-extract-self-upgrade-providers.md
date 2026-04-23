---
id: qtx-0004
title: Extract self-upgrade provider modules
status: done
priority: high
area: self
depends_on: []
human_review: required
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/self-upgrade/spec.md
  - docs/adr/0002-keep-self-upgrade-and-agent-update-separate.md
---

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
