---
id: qtx-0034
title: Harden release trigger governance
status: done
priority: high
area: release
depends_on:
  - qtx-0030
  - qtx-0032
human_review: required
checks:
  - bun run memory:check
  - bun run lint
  - bun run typecheck
docs_to_update:
  - docs/runbooks/releasing-quantex.md
  - docs/github-collaboration.md
---

# Task: Harden release trigger governance

## Goal

Release-process, documentation, and project-memory-only PRs should not accidentally create stable Release PRs through release-worthy conventional commit metadata.

## Context

PR #23 was created because release automation support landed with a `feat(release): ...` squash title. The resulting Release PR was technically correct under release-please rules, but semantically wrong for the project because the change was process infrastructure rather than user-facing product behavior.

## Constraints

- Keep release-please as the source-visible versioning path.
- Do not publish the accidental stable `0.3.0` Release PR.
- Prefer an automated PR governance check over relying on reviewer memory.
- Keep real product `feat:`, `fix:`, and `perf:` PRs release-worthy.

## Implementation Notes

- GitHub issue: https://github.com/Drswith/quantex-cli/issues/30
- Close accidental stable Release PR #23.
- Extend PR Governance to inspect changed files and PR release metadata.
- Reject release-worthy PR titles or breaking metadata when all changed files are limited to workflow, documentation, project-memory, or release configuration files.
- Document the commit-title rule in release and collaboration guidance.

## Done When

- Accidental Release PR #23 is closed.
- A PR that only changes release/process/docs/memory files cannot pass governance with `feat:`, `fix:`, `perf:`, or breaking metadata.
- Release docs explain that process-only PRs should use `ci:`, `chore:`, or `docs:` titles.

## Verification Notes

- Accidental stable Release PR: https://github.com/Drswith/quantex-cli/pull/23
- Local validation passed: `bun run memory:check`, `bun run lint`, `bun run typecheck`.
- Release trigger governance examples passed for release-process-only `feat:`, safe `chore:`/`docs:`, and real product `feat:` cases.

## Non-Goals

- Replacing release-please.
- Fully automating Release PR merge in this task.
- Changing beta channel publication semantics.
