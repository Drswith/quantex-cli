---
id: qtx-0020
title: Add release workflow smoke validation
status: planned
priority: high
area: release
depends_on: []
human_review: suggested
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/self-upgrade/spec.md
---

# Task: Add release workflow smoke validation

## Goal

Add release-time smoke validation so generated binaries and release metadata are checked before they are treated as publishable artifacts.

## Context

The release artifact pipeline exists, but the remaining backlog still calls for stronger smoke validation around produced binaries and metadata consistency.

## Constraints

- Reuse the current release-artifact flow instead of replacing it.
- Keep checks deterministic and CI-friendly.

## Implementation Notes

- Relevant files: `.github/workflows/`, `scripts/write-release-checksums.ts`, `scripts/generate-release-manifest.ts`, `scripts/verify-release-artifacts.ts`
- Relevant commands: `bun run release:artifacts`
- Relevant specs or ADRs: `openspec/specs/self-upgrade/spec.md`

## Done When

- CI validates the publishable artifacts with at least one smoke-level execution step.
- Release metadata mismatch or unusable binaries fail the workflow clearly.

## Non-Goals

- Redesigning the entire release process
