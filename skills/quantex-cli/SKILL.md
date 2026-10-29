---
name: quantex-cli
description: Use this skill when working with Quantex CLI to install, inspect, resolve, update, uninstall, or execute supported AI agent CLIs, especially when you need structured JSON output, non-interactive automation, command discovery, or reliable agent lifecycle operations through Quantex instead of calling downstream agent binaries directly.
---

# Quantex CLI

Use this skill when the task is about operating AI agent CLIs through Quantex rather than invoking each agent tool ad hoc.

When maintaining this skill from the Quantex repository, follow `AGENTS.md`. That contributor guidance does not apply to ordinary users operating the Quantex CLI.

`qtx` is the preferred short user-facing entry point in the product README. This skill keeps the explicit `quantex` form in automation examples because it is clearer in prompts, logs, and durable runbooks; treat the two names as equivalent unless a command example explicitly depends on the published package-manager shim form.

## When to use

Reach for this skill when you need to:

- inspect whether an agent is installed and how Quantex sees it
- make sure an agent is present, safely repeatable
- resolve the binary path and install source for an agent
- run an agent with explicit install policy through `quantex exec`
- update, uninstall, or diagnose supported agent CLIs
- discover Quantex commands before automation
- consume Quantex from an agent-safe, non-interactive surface

## Preferred workflow

### 1. Discover before assuming

If the environment or command surface is unclear, start with:

```bash
quantex list --json
quantex commands --json
```

Use these to confirm supported agents and the commands and flags this binary accepts before building automation around Quantex.

For command flags and usage patterns, read [references/command-recipes.md](references/command-recipes.md).
For output parsing rules and envelope expectations, read [references/output-contracts.md](references/output-contracts.md).

### 2. Use lifecycle commands with clear intent

Prefer these commands by intent:

- `quantex info <agent>` for structured state (`inspect` is an alias)
- `quantex install <agent>` to make sure an agent is present; installing one that is already there succeeds without changes (`ensure` is an alias)
- `quantex resolve <agent>` for executable entrypoint discovery
- `quantex exec <agent> -- [args...]` for managed execution
- `quantex update|uninstall <agent>` when the lifecycle action itself is the task
- `quantex doctor` when the question is diagnostic or recovery-oriented

Prefer `info --json`, `resolve`, and `exec` over scraping human-readable output in automation.

### 3. Keep human mode and agent mode separate

Quantex is `human-friendly + agent-friendly`.

- Use `qtx <agent>` or `quantex <agent>` for human shortcut flows; the README prefers `qtx` as the shorter copyable path
- Use `quantex exec <agent> -- [args...]` for automation and agent-safe invocation
- Use `--json` when another agent or tool will parse the result
- Use `--non-interactive` when prompts would be unsafe

Quantex does not switch to structured output on its own when `stdin` or `stdout` is not a TTY. Always pass `--json` in automation; prompts are skipped when either stream is not a terminal.

### 4. Add reliability controls when work is stateful or long-running

For long-running operations, prefer:

```bash
quantex install codex --json --non-interactive --timeout 2m
quantex update --all --json --run-id ops-update-20260423
quantex info claude --json --refresh
```

Use:

- `--timeout` to bound long operations
- `--run-id` to correlate logs and results
- `--refresh` or `--no-cache` when stale version data would be risky

`install`, `update`, and `uninstall` are safe to retry: when nothing is left to do they succeed without changes.

For automation patterns and output contracts, read [references/output-contracts.md](references/output-contracts.md).

### 5. Diagnose before patching around failures

When Quantex behaves unexpectedly, prefer diagnosis over ad hoc workarounds:

```bash
quantex info codex --json
quantex doctor
```

Use [docs/runbooks/quantex-troubleshooting.md](../../docs/runbooks/quantex-troubleshooting.md) for common failure patterns, recovery order, and when to reach for `doctor`, `info`, `resolve`, `--refresh`, or retries.

### 6. Validate the surface when maintaining the CLI or this skill

When the Quantex command surface changes, run:

```bash
skills/quantex-cli/scripts/smoke-check.sh
```

This performs a light structured-output smoke check across discovery commands and key lifecycle read paths.

## Guardrails

- Do not treat Quantex as a workflow orchestration platform. Its mainline scope is lifecycle management and stable execution contracts.
- Do not depend on human-readable colorized output for parsing.
- Do not pass downstream agent flags before `--` when using `exec`.
- Do not prefer `quantex <agent>` in non-interactive automation; shortcut flows are for humans first.
- When you need exact output fields, read a `--json` result and [references/output-contracts.md](references/output-contracts.md) instead of guessing.
- When automating against Quantex, prefer stable contracts over inferred behavior from one terminal session.

## Quick examples

```bash
# Inspect state for automation
quantex info codex --json

# Make sure an agent exists before use
quantex install claude --json --non-interactive --yes

# Resolve the binary path Quantex would use
quantex resolve codex --json

# Execute with explicit install behavior
quantex exec codex --install if-missing -- --help

# Discover stable commands
quantex commands --json
```
