---
id: qtx-0022
title: Document skill installation and distribution flow
status: done
priority: low
area: docs
depends_on: []
human_review: suggested
checks:
  - bun run lint
  - bun run typecheck
docs_to_update:
  - docs/README.md
  - skills/quantex-cli/
---

# Task: Document skill installation and distribution flow

## Goal

Write down how the Quantex skill should be installed, updated, and distributed so future contributors and agents are not relying on implicit local knowledge.

## Context

The skill already exists, but the remaining backlog still calls out missing distribution documentation. This is a knowledge gap rather than a core runtime gap.

## Constraints

- Keep the documentation aligned with the current skill layout in the repo.
- Avoid inventing a package or marketplace flow that does not exist yet.

## Implementation Notes

- Relevant files: `skills/quantex-cli/`, `docs/README.md`
- Relevant commands: current local install or smoke-check commands
- Relevant specs or ADRs: none required unless the distribution model changes

## Done When

- A contributor can understand how to install and validate the Quantex skill from repo docs alone.
- The docs make clear what is supported today versus still aspirational.

## Non-Goals

- Building a separate skill publishing platform
