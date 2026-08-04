# OpenSpec

OpenSpec holds behavior contracts and non-trivial change planning. For complete workflow process (intake, validation, closure), see `skills/quantex-agent-runtime/SKILL.md`.

## Structure

| Path | Purpose |
|---|---|
| `openspec/specs/` | Current source-of-truth behavior specifications |
| `openspec/config.yaml` | Project context and artifact rules |
| `openspec/changes/` | Active non-trivial changes before archive closure |

Completed changes are archived via `bun run openspec:archive-closure` (agent-driven); archived artifacts are not retained in the working tree.

## Commands

```bash
bun run openspec:list
bun run openspec:status -- --change <change-name>
bun run openspec:validate
bun run openspec:archive-closure -- <change-id> [--apply-specs] [--body-file <path>]
```

For creating changes and reading artifact instructions, use the native OpenSpec CLI:

```bash
bunx openspec new change <change-name>
bunx openspec instructions <artifact> --change <change-name>
```

## Rules summary

- Classify work through the intake gate before editing files (details in runtime skill).
- Archive closure is agent-driven on protected branches; use `openspec:archive-closure`, not bot automation.
- Keep agent bootstrap files thin; route to `skills/quantex-agent-runtime/SKILL.md`.
