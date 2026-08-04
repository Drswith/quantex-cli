# Project Memory

This repository uses a repo-native project memory system designed for `human + agent` collaboration.

## Source of truth

| Location | Purpose |
|---|---|
| `openspec/specs/` | Current behavior and durable process contracts |
| `openspec/changes/` | Active non-trivial changes before archive closure |
| `docs/adr/` | Long-lived architectural and product decisions |
| `docs/runbooks/` | Repeated operational knowledge and recovery procedures |
| `docs/postmortems/` | Failure analysis after incidents |
| `docs/sessions/` | Concise discussion summaries |
| `skills/quantex-agent-runtime/` | Central runtime rules for coding-agent sessions |

Do not create new root-level ad hoc markdown for these categories. Workflow process details live in `skills/quantex-agent-runtime/SKILL.md`.

## Discussion funnel

1. Capture discussion summary in `docs/sessions/`.
2. Promote behavior/process changes into `openspec/`.
3. Promote durable design choices into `docs/adr/`.
4. Promote troubleshooting knowledge into `docs/runbooks/`.
5. Promote executable work into GitHub issues or OpenSpec changes.

## Links

- [github-collaboration.md](./github-collaboration.md) — GitHub roles, PR mechanics, branch protection
- [releases.md](./releases.md) — release overview
- [runbooks/README.md](./runbooks/README.md) — operational runbooks index
- [skill-installation-and-distribution.md](./skill-installation-and-distribution.md)
- [agent-support-matrix.md](./agent-support-matrix.md)
