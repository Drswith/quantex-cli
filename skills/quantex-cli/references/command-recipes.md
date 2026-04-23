# Command Recipes

Use this file when you need concrete Quantex command choices, example invocations, or a reminder of which command fits which lifecycle task.

## Supported agents

Quantex currently manages these agent names:

- `claude`
- `codex`
- `copilot`
- `cursor`
- `droid`
- `gemini`
- `opencode`
- `pi`

If you are unsure whether the current binary supports a specific command or output shape, run:

```bash
quantex capabilities --json
quantex commands --json
```

## Pick the right command

### Discovery and inspection

```bash
quantex list
quantex info codex
quantex inspect codex --json
quantex resolve codex --json
quantex capabilities --json
quantex commands --json
quantex schema --json
```

Use:

- `list` for human overview
- `info` for human-friendly details
- `inspect` for structured state
- `resolve` for executable path and launch resolution
- `capabilities`, `commands`, `schema` for self-description

### Installation and updates

```bash
quantex install claude --json --yes --non-interactive
quantex ensure claude --json --yes --non-interactive
quantex update claude --json
quantex update --all --output ndjson
quantex uninstall claude --json
```

Prefer:

- `ensure` when the goal is "agent must be present"
- `install` when the task is explicitly to install
- `update --all --output ndjson` when tracking multi-agent progress

### Execution

```bash
quantex exec codex --install never -- --help
quantex exec claude --install if-missing -- --dangerously-skip-permissions
```

Rules:

- put all downstream agent arguments after `--`
- use `exec` instead of `quantex <agent>` in automation
- prefer `--install never` when mutation would be surprising
- prefer `--install if-missing` when you want lifecycle management and execution in one step

### Configuration and diagnosis

```bash
quantex config
quantex config get defaultPackageManager
quantex config set defaultPackageManager npm
quantex doctor --json
quantex upgrade --check --json
```

Use:

- `config` for CLI policy and defaults
- `doctor` for environment or recovery diagnosis, especially when another agent should consume structured remediation hints
- `upgrade` for Quantex itself, not downstream agents

## High-value global flags

These flags matter most in agent workflows:

- `--json`
- `--output <human|json|ndjson>`
- `--non-interactive`
- `--yes`
- `--quiet`
- `--dry-run`
- `--refresh`
- `--no-cache`
- `--run-id <id>`
- `--timeout <duration>`
- `--idempotency-key <key>`

## Heuristics

- If another system will parse the result, use `--json` or `--output ndjson`.
- If the task may retry, add `--idempotency-key` on mutating commands.
- If timing is uncertain, add `--timeout`.
- If cached version data would be misleading, add `--refresh`.
- If you need a stable command inventory, read `commands --json` instead of hard-coding assumptions.
