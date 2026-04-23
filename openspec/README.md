# OpenSpec

This repository uses an OpenSpec-compatible layout for behavior contracts and change planning.

## Structure

| Path | Purpose |
|---|---|
| `openspec/specs/` | Current source-of-truth behavior specifications |
| `openspec/changes/` | Proposed non-trivial changes before they are fully merged |
| `openspec/changes/archive/` | Completed changes that have already been merged into current specs |

## Working rule

- put current behavior in `openspec/specs/`
- put pending behavior changes in `openspec/changes/<change-name>/`
- keep proposal, design, tasks, and delta specs in the same change folder
- after the work lands, merge the spec delta into `openspec/specs/` and archive the change

This layout is useful even before installing the OpenSpec CLI, and it stays compatible if the project later adopts the official tool.
