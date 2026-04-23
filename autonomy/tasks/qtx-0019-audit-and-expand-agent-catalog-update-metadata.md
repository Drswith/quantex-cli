---
id: qtx-0019
title: Audit and expand agent catalog update metadata
status: done
priority: high
area: agents
depends_on: []
human_review: suggested
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/agent-update/spec.md
---

# Task: Audit and expand agent catalog update metadata

## Goal

Audit the current agent catalog and close the highest-value gaps in `selfUpdate`, `versionProbe`, package names, and homepage metadata.

## Context

Future autonomous work depends on the registry being trustworthy. The remaining backlog items are less about new architecture and more about keeping catalog metadata accurate.

## Constraints

- Focus on the supported agent set rather than expanding into every possible integration.
- Prefer explicit metadata in definitions over command-layer special cases.

## Implementation Notes

- Relevant files: `src/agents/definitions/`, agent update tests
- Relevant commands: `quantex inspect <agent>`, `quantex update <agent>`
- Relevant specs or ADRs: `openspec/specs/agent-update/spec.md`

## Done When

- The main supported agents have reviewed update metadata.
- Any remaining catalog gaps are narrowed to explicit follow-up tasks or comments.

## Non-Goals

- Adding unrelated workflow-orchestration style features
