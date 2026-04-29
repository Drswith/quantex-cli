# Project Memory

This repository uses a repo-native project memory system designed for `human + agent` collaboration and future autonomous iteration.

## Source of truth

Use these directories as the canonical places to write project knowledge:

| Location | Purpose |
|---|---|
| `openspec/specs/` | Current behavior and durable process contracts that the project is expected to satisfy |
| `openspec/changes/` | Proposed non-trivial behavior or durable-process changes before or during implementation |
| `docs/adr/` | Long-lived architectural and product decisions |
| `docs/runbooks/` | Repeated operational knowledge, diagnostics, and recovery procedures |
| `docs/postmortems/` | Failure analysis and lessons learned after incidents or costly mistakes |
| `docs/sessions/` | Concise discussion summaries and decisions from a working session |
| `openspec/changes/archive/` | Completed OpenSpec changes, including migrated historical task contracts |
| `skills/quantex-agent-runtime/` | Central Superpowers-backed runtime rules for coding-agent sessions |

Do not create new root-level ad hoc markdown files for these categories.

## Discussion funnel

Discussion transcripts are not the long-term artifact. Use this funnel instead:

1. Capture the discussion summary in `docs/sessions/`.
2. Promote stable behavior and durable process changes into `openspec/`.
3. Promote durable design choices into `docs/adr/`.
4. Promote recurring troubleshooting knowledge into `docs/runbooks/`.
5. Promote actionable follow-up work into GitHub issues or OpenSpec changes.

This keeps the project memory compact, searchable, and safe for future agent iteration.

## Working rhythm

For a typical feature or refactor:

1. Activate Superpowers when available and follow `skills/quantex-agent-runtime/SKILL.md`.
2. Start with a session summary if the discussion materially changes project direction.
3. Create or update an OpenSpec artifact for any non-trivial behavior or durable process change.
4. Record an ADR if the change introduces a lasting design or scope decision.
5. Use GitHub issues for executable work tracking.
6. Update a runbook or postmortem if the work revealed a reusable debugging or recovery pattern.

GitHub workflow guidance:

- [github-collaboration.md](./github-collaboration.md)
- [releases.md](./releases.md)
- [skill-installation-and-distribution.md](./skill-installation-and-distribution.md)

Operational runbooks:

- [quantex-troubleshooting.md](./runbooks/quantex-troubleshooting.md)
- [releasing-quantex.md](./runbooks/releasing-quantex.md)
- [release-and-self-upgrade-debugging.md](./runbooks/release-and-self-upgrade-debugging.md)

## Migration status

Legacy root-level design and backlog documents have been archived under [archive/legacy-root-notes/](./archive/legacy-root-notes/). The old `qtx-*` task queue was migrated into [OpenSpec archived change history](../openspec/changes/archive/qtx-task-history.md). Root document cleanup status is tracked in [project-memory-migration.md](./project-memory-migration.md).
