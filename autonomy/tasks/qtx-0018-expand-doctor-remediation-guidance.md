---
id: qtx-0018
title: Expand doctor remediation guidance
status: ready
priority: high
area: doctor
depends_on: []
human_review: suggested
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - docs/runbooks/quantex-troubleshooting.md
  - openspec/specs/self-upgrade/spec.md
---

# Task: Expand doctor remediation guidance

## Goal

Make `quantex doctor` return more actionable remediation guidance for common self-upgrade, package-manager, and PATH problems.

## Context

The current troubleshooting knowledge is richer than the command output. Future agents and human users both benefit when doctor results point directly to likely fixes.

## Constraints

- Preserve the existing structured result contract.
- Avoid turning `doctor` into an interactive repair workflow.

## Implementation Notes

- Relevant files: `src/commands/doctor.ts`, `src/self/`, `docs/runbooks/quantex-troubleshooting.md`
- Relevant commands: `quantex doctor`, `quantex upgrade --check`
- Relevant specs or ADRs: `openspec/specs/self-upgrade/spec.md`

## Done When

- `doctor` surfaces clearer remediation hints for representative environment failures.
- Tests cover at least the common self-upgrade and installation drift cases.

## Non-Goals

- Automatic repair execution from `doctor`
