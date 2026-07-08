## Overview

This is a documentation and backlog-tracking sync only. The CLI already supports the agents being documented, so the work is to realign active Markdown surfaces and the top-level GitHub backlog issue with existing source-of-truth artifacts.

## Source Of Truth

- Supported agent identities come from `src/agents/catalog/*.json`.
- The current runnable support snapshot can be verified with `bun run dev -- list --json`.
- Existing README expectations come from `openspec/specs/product-readme/spec.md`.
- Durable docs/process alignment comes from `openspec/specs/project-memory/spec.md`.
- Unsupported-candidate triage remains in GitHub issue `#134` until a successor issue is explicitly declared.

## Decisions

- Update active docs first and leave historical archives as point-in-time records.
- Keep issue `#134` as the planning-only top-level agent-catalog backlog rather than splitting it into another repo-local tracker.
- Make `docs/agent-support-matrix.md` point clearly at the supported catalog and the backlog issue instead of duplicating long candidate ledgers.
- Keep the skill-facing support snapshot in `skills/quantex-cli/references/command-recipes.md`, but require it to stay aligned with the live catalog and discovery commands.

## Non-Goals

- Do not change CLI behavior, output schemas, install/update logic, or release automation.
- Do not rewrite archived OpenSpec changes, session summaries, postmortems, or legacy archive notes into current-state docs.
- Do not introduce generated Markdown tooling in this change.
