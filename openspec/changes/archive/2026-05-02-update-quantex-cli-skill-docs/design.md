## Context

Quantex currently ships two repo-local skills with different audiences:

- `skills/quantex-cli`: user/agent-facing operating guidance for installing, inspecting, ensuring, resolving, updating, uninstalling, and executing supported agent CLIs through Quantex.
- `skills/quantex-agent-runtime`: contributor-facing repository workflow runtime for Quantex development sessions, including Superpowers, OpenSpec intake, validation, and delivery closure.

The public README and skill distribution docs should not present the runtime skill as part of the normal external user installation flow. The `quantex-cli` skill references should also avoid copied stale catalogs when the CLI already exposes `capabilities --json`, `commands --json`, and `schema --json`.

## Decisions

- Keep `quantex-cli` as the only normal user-facing skill installation target.
- Document `quantex-agent-runtime` as a repository contributor runtime, used when working inside this repo.
- Replace stale supported-agent copy in the skill reference with the current catalog and a reminder to prefer `quantex capabilities --json` for source-of-truth discovery.
- Sync the skill troubleshooting mirror with the canonical runbook content without making the mirror the source of truth.

## Non-Goals

- No new skill package, marketplace, or automated skill publishing flow.
- No CLI behavior, schema, command, install-source, or release behavior change.
- No expansion toward workflow orchestration.
