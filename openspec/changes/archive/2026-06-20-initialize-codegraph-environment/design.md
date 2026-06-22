## Context

The repository now includes CodeGraph metadata so agents can answer structural code questions through the configured MCP server. Codex environment setup still only installs dependencies with a mutable `bun install`, so a fresh environment can start without an initialized CodeGraph index and can accidentally update dependency resolution.

## Goals / Non-Goals

**Goals:**

- Make Codex environment setup deterministic by enforcing the committed Bun lockfile.
- Initialize CodeGraph as part of the environment bootstrap so structural exploration tools are ready before task work starts.
- Keep cleanup limited to local transient files generated during agent work and package smoke checks.

**Non-Goals:**

- Change the Quantex CLI runtime surface, package contents, or user-facing commands.
- Add new repository workflow orchestration commands.
- Require contributors outside Codex environments to use CodeGraph.

## Decisions

- Use `bun install --frozen-lockfile` instead of `bun install` in `.codex/environments/environment.toml`.
  This keeps dependency installation aligned with CI and avoids accidental lockfile churn during environment setup.
- Run `codegraph init -i` in the setup script.
  This reuses the existing CodeGraph CLI and local `.codegraph/` metadata instead of adding a repository-specific bootstrap command.
- Keep cleanup scoped to `.tmp` and `quantex-*.tgz`.
  These paths are transient agent and package artifacts, and removing them does not affect source, specs, or release artifacts.
- Ignore CodeGraph PID and socket files under `.codegraph/`.
  These are runtime coordination artifacts and should not appear as reviewable repository changes.

## Risks / Trade-offs

- `codegraph init -i` depends on the CodeGraph CLI being available in Codex setup environments. The Codex environment should fail early if that tooling is missing instead of starting without the expected structural index.
- Removing `.tmp` during cleanup discards local PR body drafts and scratch files. Those files are intentionally transient and can be regenerated from committed sources or repository scripts.
