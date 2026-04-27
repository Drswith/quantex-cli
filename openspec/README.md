# OpenSpec

This repository uses an OpenSpec-compatible layout for behavior contracts and non-trivial change planning.

## Structure

| Path | Purpose |
|---|---|
| `openspec/specs/` | Current source-of-truth behavior specifications |
| `openspec/changes/` | Proposed non-trivial changes before they are fully merged |
| `openspec/changes/archive/` | Completed changes that have already been merged into current specs |

## Working rule

- put current behavior in `openspec/specs/`
- put pending non-trivial behavior or durable-process changes in `openspec/changes/<change-name>/`
- keep proposal, design, tasks, and delta specs in the same change folder
- after the work lands, merge the spec delta into `openspec/specs/` and archive the change

Prefer the official OpenSpec CLI or slash commands when available. This repository should store OpenSpec-compatible artifacts, not grow custom project-management commands unless they directly serve Quantex users.

Small fixes that do not alter behavior contracts can still go directly through GitHub Issue/PR review without an OpenSpec change.
