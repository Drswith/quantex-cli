---
id: qtx-0001
title: Migrate troubleshooting knowledge into canonical runbooks
status: done
priority: high
area: docs
depends_on: []
human_review: suggested
checks:
  - bun run lint
  - bun run typecheck
docs_to_update:
  - docs/runbooks/
  - skills/quantex-cli/references/troubleshooting.md
---

# Task: Migrate troubleshooting knowledge into canonical runbooks

## Goal

Establish `docs/runbooks/` as the canonical home for Quantex troubleshooting guidance and reduce future divergence between the skill reference and the project memory system.

## Context

The repository already has a strong troubleshooting document in `skills/quantex-cli/references/troubleshooting.md`, but it lives inside the skill tree instead of the main project memory structure.

## Constraints

- Keep the skill usable while migration is in progress.
- Do not delete the existing reference until the canonical runbook exists and links are updated.

## Implementation Notes

- Create one or more runbooks under `docs/runbooks/`.
- Decide whether the skill reference should become a thin pointer or remain a synced derivative.
- Update any relevant links in `README.md` and `skills/quantex-cli/SKILL.md` if needed.

## Done When

- A canonical troubleshooting runbook exists in `docs/runbooks/`.
- The migration strategy for the skill reference is explicit.
- Future updates can happen in one canonical place first.

## Non-Goals

- Rewriting the underlying troubleshooting guidance from scratch.

## Outcome

- Canonical runbook created at `docs/runbooks/quantex-troubleshooting.md`.
- `skills/quantex-cli/references/troubleshooting.md` is now explicitly marked as a mirror of the canonical runbook.
