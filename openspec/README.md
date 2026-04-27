# OpenSpec

This repository uses OpenSpec and the OPSX workflow for behavior contracts and non-trivial change planning.

## Structure

| Path | Purpose |
|---|---|
| `openspec/specs/` | Current source-of-truth behavior specifications |
| `openspec/config.yaml` | Project context and artifact rules injected into OpenSpec instructions |
| `openspec/changes/` | Proposed non-trivial changes before they are fully merged |
| `openspec/changes/archive/` | Completed changes that have already been merged into current specs |

## Working rule

- use `/opsx:explore` or equivalent for open-ended investigation
- use `/opsx:propose` or `openspec new change <name>` for non-trivial behavior or durable-process changes
- use `openspec status --change <name> --json` to inspect which artifacts are ready or missing
- use `openspec instructions <artifact> --change <name> --json` when an agent needs artifact-specific guidance
- use `/opsx:apply` or equivalent to implement tasks while updating artifacts as learning happens
- after the implementation PR lands, the change is still only "implemented"
- treat the change as fully "done" only after specs are synced and `/opsx:archive` or `openspec archive <name> --yes` has moved it into `openspec/changes/archive/`
- protected branches should close that final gap through an archive follow-up PR rather than relying on memory

Prefer the official OpenSpec CLI or slash commands when available. This repository should store OpenSpec artifacts, not grow custom project-management commands unless they directly serve Quantex users.

The CLI is pinned as a project dev dependency. Use the repo scripts instead of relying on a global install:

```bash
bun run openspec:list
bun run openspec:status -- --change <change-name>
bun run openspec:show -- <change-or-spec-name>
bun run openspec:instructions -- proposal --change <change-name>
bun run openspec:validate
bun run openspec:new -- <change-name>
bun run openspec:archive -- <change-name>
```

`openspec init` has generated OPSX integrations for Codex, Claude Code, Gemini CLI, Cursor, GitHub Copilot, and OpenCode. Keep generated OPSX files close to upstream output; put project-specific context in `openspec/config.yaml` instead.

Current OPSX profile:

- supported core actions: explore, propose, apply, archive
- not enabled yet: expanded actions such as continue, fast-forward, verify, sync, bulk archive, and onboard
- if a generated prompt mentions an expanded action that is not present in this repository, use the closest core action plus `openspec status`, `openspec instructions`, manual spec updates, and `openspec validate`

Generated OPSX files under agent-specific directories should normally be regenerated with `openspec init` or `openspec update`, not hand-edited. Put Quantex-specific workflow context and artifact rules in `openspec/config.yaml`.

Archive timing:

- do not archive an active change before its implementation PR has merged
- sync any accepted spec delta into `openspec/specs/` before archiving
- run `bun run openspec:validate` before and after archive operations
- on `main` and `beta`, the repository should open an archive follow-up PR for completed active changes so merge/release success does not leave project memory half-closed

Small fixes that do not alter behavior contracts can still go directly through GitHub Issue/PR review without an OpenSpec change.
