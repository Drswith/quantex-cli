# Consolidate Agent Skill Bootstrap

## Summary

Add a common `.agents` bootstrap for the contributor-facing Quantex agent runtime and remove the obsolete Superset local setup file.

## Motivation

The repository already keeps durable Quantex workflow rules in `skills/quantex-agent-runtime/SKILL.md` and allows thin agent bootstrap files. A common `.agents` bootstrap gives compatible agent runtimes a shared entry point while preserving the central runtime skill as the source of truth.

The Superset local configuration is no longer part of the maintained contributor workflow and should not remain as an active setup contract.

## Scope

- Add `.agents/skills/quantex-agent-runtime/SKILL.md` as a thin pointer to the central runtime skill.
- Remove `.superset/config.json`.
- Record the project-memory contract for the common bootstrap entry point.

## Non-goals

- Do not rewrite the central runtime skill.
- Do not replace every agent-specific bootstrap directory.
- Do not add new project-local workflow commands.
