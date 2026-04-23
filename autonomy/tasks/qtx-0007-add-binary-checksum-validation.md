---
id: qtx-0007
title: Add checksum validation for binary self-upgrade
status: planned
priority: high
area: self
depends_on:
  - qtx-0006
human_review: required
checks:
  - bun run lint
  - bun run typecheck
  - bun run test
docs_to_update:
  - openspec/specs/self-upgrade/spec.md
---

# Task: Add checksum validation for binary self-upgrade

## Goal

Ensure downloaded self-upgrade binaries are verified before replacement.

## Context

Checksum validation is one of the main missing safety guarantees captured in the legacy auto-upgrade scope.

## Constraints

- Do not overwrite the installed executable with an unverified payload.
- Keep the design reusable for future manifest-driven release metadata.

## Implementation Notes

- Add reusable download-and-verify utilities.
- Surface checksum failures as typed upgrade errors.

## Done When

- Binary self-upgrade validates checksums before replacement.
- Checksum mismatch aborts the upgrade and reports a typed failure.

## Non-Goals

- Full release manifest support.
