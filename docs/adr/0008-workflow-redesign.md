# ADR 0008: Workflow Redesign — Consolidated CI and Automatic Release

## Status

Accepted

## Context

The repository accumulated overlapping workflow documentation across `AGENTS.md`, `SKILL.md`, `openspec/README.md`, and `docs/github-collaboration.md`. CI invoked scripts through both `package.json` and direct `scripts/` paths. Seven GitHub workflows included manual Prepare/Seal release steps that diverged from release-please conventions and from the `release-workflow` spec. OpenSpec archive history (212 changes) dominated the working tree and added agent noise.

## Decision

1. **Documentation hierarchy**: `skills/quantex-agent-runtime/SKILL.md` holds the complete workflow process; `AGENTS.md` stays thin; other docs are pointers.
2. **Archive policy**: Completed OpenSpec changes archive via agent-driven `openspec:archive-closure`; archived folders are not retained in the working tree (git history preserves archaeology).
3. **CI consolidation**: Merge gates live in `ci.yml` (lint, governance, platform tests); `sandbox-tests.yml` remains separate with honest skip semantics.
4. **Release automation**: `release-please.yml` on push to `main`/`beta` opens Release PRs; merge creates tag; `release.yml` publishes on tag without re-running merge CI gates.
5. **Ruleset alignment**: `main` and `beta` require `lint`, three platform test contexts, and `sandbox-tests`; `classify` is not required.

## Consequences

- Maintainers no longer dispatch Prepare/Seal workflows.
- First automatic release after merge should be monitored on `beta` before relying on stable flow.
- Historical OpenSpec changes and `docs/archive/` are removed from the working tree; use git history for archaeology.
- `openspec:*` package scripts are reduced to `list`, `status`, `validate`, and `archive-closure`; other OpenSpec CLI commands use `bunx openspec`.
