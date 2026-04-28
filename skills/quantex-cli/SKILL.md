---
name: quantex-cli
description: Use this skill when working with Quantex CLI to install, inspect, ensure, resolve, update, uninstall, or execute supported AI agent CLIs, especially when you need structured JSON or NDJSON output, non-interactive automation, capability discovery, or reliable agent lifecycle operations through Quantex instead of calling downstream agent binaries directly.
---

# Quantex CLI

Use this skill when the task is about operating AI agent CLIs through Quantex rather than invoking each agent tool ad hoc.

`qtx` is the preferred short user-facing entry point in the product README. This skill keeps the explicit `quantex` form in automation examples because it is clearer in prompts, logs, and durable runbooks; treat the two names as equivalent unless a command example explicitly depends on the published package-manager shim form.

## When to use

Reach for this skill when you need to:

- inspect whether an agent is installed and how Quantex sees it
- ensure an agent is present with idempotent behavior
- resolve the binary path and install source for an agent
- run an agent with explicit install policy through `quantex exec`
- update, uninstall, or diagnose supported agent CLIs
- discover Quantex command capabilities or output schemas before automation
- consume Quantex from an agent-safe, non-interactive surface

## Preferred workflow

### 1. Discover before assuming

If the environment or command surface is unclear, start with:

```bash
quantex capabilities --json
quantex commands --json
quantex schema --json
```

Use these to confirm supported agents, output modes, install policies, and command schemas before building automation around Quantex.

For command flags and usage patterns, read [references/command-recipes.md](references/command-recipes.md).
For output parsing rules and envelope expectations, read [references/output-contracts.md](references/output-contracts.md).

### 2. Use lifecycle commands with clear intent

Prefer these commands by intent:

- `quantex inspect <agent>` for structured state
- `quantex ensure <agent>` for idempotent installation
- `quantex resolve <agent>` for executable entrypoint discovery
- `quantex exec <agent> -- [args...]` for managed execution
- `quantex install|update|uninstall <agent>` when the lifecycle action itself is the task
- `quantex doctor` when the question is diagnostic or recovery-oriented

Prefer `inspect`, `ensure`, `resolve`, and `exec` over scraping human-readable `list` or `info` output in automation.

### 3. Keep human mode and agent mode separate

Quantex is `human-friendly + agent-friendly`.

- Use `qtx <agent>` or `quantex <agent>` for human shortcut flows; the README prefers `qtx` as the shorter copyable path
- Use `quantex exec <agent> -- [args...]` for automation and agent-safe invocation
- Use `--json` or `--output ndjson` when another agent or tool will parse the result
- Use `--non-interactive` when prompts would be unsafe

Quantex now auto-switches to agent-friendly defaults when `stdin` or `stdout` is not a TTY. Even so, prefer explicit flags in automation so the contract is obvious.

### 4. Add reliability controls when work is stateful or long-running

For retriable or long-running operations, prefer:

```bash
quantex ensure codex --json --non-interactive --idempotency-key ensure-codex-001 --timeout 2m
quantex update --all --output ndjson --run-id ops-update-20260423
quantex inspect claude --json --refresh
```

Use:

- `--idempotency-key` to make retries safe on mutating commands
- `--timeout` to bound long operations
- `--run-id` to correlate logs and results
- `--refresh` or `--no-cache` when stale version data would be risky

For automation patterns and output contracts, read [references/automation-playbook.md](references/automation-playbook.md).

### 5. Diagnose before patching around failures

When Quantex behaves unexpectedly, prefer diagnosis over ad hoc workarounds:

```bash
quantex inspect codex --json
quantex doctor
```

Use [references/troubleshooting.md](references/troubleshooting.md) for common failure patterns, recovery order, and when to reach for `doctor`, `inspect`, `resolve`, `refresh`, or retries.

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
- When you need exact output fields, consult `quantex schema --json` instead of guessing.
- When automating against Quantex, prefer stable contracts over inferred behavior from one terminal session.

## Quick examples

```bash
# Inspect state for automation
quantex inspect codex --json

# Ensure an agent exists before use
quantex ensure claude --json --non-interactive --yes

# Resolve the binary path Quantex would use
quantex resolve gemini --json

# Execute with explicit install behavior
quantex exec codex --install if-missing -- --help

# Discover stable commands and schemas
quantex commands --json
quantex schema inspect --json
```
