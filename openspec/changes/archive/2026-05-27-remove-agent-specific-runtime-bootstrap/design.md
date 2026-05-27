## Design

The change removes repository-maintained mirrors for agent-specific runtime bootstrap files and leaves the canonical workflow in the central runtime skill plus OpenSpec artifacts.

Agent environments can still discover Quantex runtime guidance in one of three ways:

- Native Superpowers or skill invocation when the environment provides it.
- The text-first task start prompt documented in `skills/quantex-agent-runtime/SKILL.md`.
- The fallback constraints in `AGENTS.md` and `openspec/README.md`.

This keeps the repository from owning multiple agent-specific copies of the same workflow contract. Future workflow changes should update `skills/quantex-agent-runtime/SKILL.md`, `AGENTS.md`, `openspec/README.md`, or the relevant OpenSpec spec instead of adding local mirror files for every agent.

Codex workspace setup metadata is different from runtime workflow policy. `.codex/environments/environment.toml` only describes the hosted environment setup command and is not a durable agent-behavior contract.

## Alternatives Considered

- Keep all per-agent bootstrap files and update them when workflow rules change. This preserves native discovery in more local agent folders but keeps a known drift surface alive.
- Replace each deleted file with an even shorter pointer. This still requires maintaining duplicated file paths across agent integrations without adding behavior beyond the canonical text-first entry.

## Rollout

This is a repository process/docs change only. It does not change the Quantex CLI runtime, package surface, command catalog, or release artifact contents.
