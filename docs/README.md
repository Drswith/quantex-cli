# Project Memory

This repository uses a repo-native project memory system designed for `human + agent` collaboration and future autonomous iteration.

## Source of truth

Use these directories as the canonical places to write project knowledge:

| Location | Purpose |
|---|---|
| `openspec/specs/` | Current behavior and contracts that the project is expected to satisfy |
| `openspec/changes/` | Proposed non-trivial behavior changes before or during implementation |
| `docs/adr/` | Long-lived architectural and product decisions |
| `docs/runbooks/` | Repeated operational knowledge, diagnostics, and recovery procedures |
| `docs/postmortems/` | Failure analysis and lessons learned after incidents or costly mistakes |
| `docs/sessions/` | Concise discussion summaries and decisions from a working session |
| `autonomy/tasks/` | Agent-executable tasks with explicit scope, risks, and done criteria |
| `autonomy/queue.md` | Ordered view of what the agent should work on next |

Do not create new root-level ad hoc markdown files for these categories.

## Discussion funnel

Discussion transcripts are not the long-term artifact. Use this funnel instead:

1. Capture the discussion summary in `docs/sessions/`.
2. Promote stable behavior changes into `openspec/`.
3. Promote durable design choices into `docs/adr/`.
4. Promote recurring troubleshooting knowledge into `docs/runbooks/`.
5. Promote actionable follow-up work into `autonomy/tasks/` and `autonomy/queue.md`.

This keeps the project memory compact, searchable, and safe for future agent iteration.

## Working rhythm

For a typical feature or refactor:

1. Start with a session summary if the discussion materially changes project direction.
2. Create or update an OpenSpec artifact for any non-trivial behavior change.
3. Record an ADR if the change introduces a lasting design or scope decision.
4. Create one or more autonomy tasks if the work should continue asynchronously or in future sessions.
5. Update a runbook or postmortem if the work revealed a reusable debugging or recovery pattern.

Useful scaffolds:

- `bun run task:new -- --title "Task title"`
- `bun run adr:new -- --title "Decision title"`

GitHub workflow guidance:

- [github-collaboration.md](./github-collaboration.md)

## Migration status

Legacy root-level design and backlog documents still exist during the transition. Their target homes are tracked in [project-memory-migration.md](./project-memory-migration.md).
