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
- after the work lands and specs are synced, use `/opsx:archive` or `openspec archive <name> --yes`

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

Small fixes that do not alter behavior contracts can still go directly through GitHub Issue/PR review without an OpenSpec change.
