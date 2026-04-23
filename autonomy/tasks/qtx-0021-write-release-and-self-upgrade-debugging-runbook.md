---
id: qtx-0021
title: Write release and self-upgrade debugging runbook
status: done
priority: medium
area: docs
depends_on: []
human_review: suggested
checks:
  - bun run lint
  - bun run typecheck
docs_to_update:
  - docs/runbooks/
  - docs/README.md
---

# Task: Write release and self-upgrade debugging runbook

## Goal

Document the contributor workflow for reproducing, debugging, and validating release-artifact and self-upgrade issues.

## Context

The project now has more release and upgrade machinery than a casual contributor can infer from code alone. A stable runbook will reduce re-discovery during future agent-led maintenance.

## Constraints

- Prefer concrete commands from the current repo over abstract guidance.
- Keep the runbook focused on debugging and validation, not general contribution onboarding.

## Implementation Notes

- Relevant files: `docs/runbooks/`, release scripts, `src/self/`
- Relevant commands: `bun run build:bin`, `bun run release:artifacts`, `quantex upgrade --check`
- Relevant specs or ADRs: `openspec/specs/self-upgrade/spec.md`

## Done When

- Contributors can follow one runbook to inspect release artifacts and self-upgrade behavior locally.
- The docs point to the canonical validation commands and common failure symptoms.

## Non-Goals

- Full release automation redesign
