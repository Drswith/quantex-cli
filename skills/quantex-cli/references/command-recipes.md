# Command Recipes

Use this file when you need concrete Quantex command choices, example invocations, or a reminder of which command fits which lifecycle task.

## Supported agents

This skill snapshot knows about these Quantex agent names:

- `amp`
- `antigravity`
- `claude`
- `codebuddy`
- `codex`
- `commandcode`
- `copilot`
- `crush`
- `cursor`
- `devin`
- `droid`
- `dsh`
- `grok`
- `hermes`
- `kilo`
- `kimi`
- `mimo`
- `openclaw`
- `opencode`
- `omp`
- `pi`
- `qoder`

The running binary remains the source of truth. If you are unsure whether the current binary supports a specific agent, command, or flag, run:

```bash
quantex list --json
quantex commands --json
```

## Pick the right command

### Discovery and inspection

```bash
quantex list
quantex list --json
quantex info codex
quantex info codex --json
quantex resolve codex --json
quantex commands --json
```

Use:

- `list` for human overview
- `list --json` for an exact supported-agent inventory
- `info` for details and structured state (`inspect` is an alias)
- `resolve` for executable path and launch resolution
- `commands` for self-description

When `resolve --json` reports `AGENT_NOT_INSTALLED`, prefer `data.resolution.installGuidance` instead of scraping the error text. It includes a suggested install command plus install methods Quantex can attempt.

### Installation and updates

```bash
quantex install claude --json --yes --non-interactive
quantex update claude --json
quantex update --all --json
quantex uninstall claude --json
```

Prefer:

- `install` both to install and to make sure an agent is present; an agent that is already installed is left alone (`ensure` is an alias)
- `update --all --json` to update everything Quantex manages, with one result per agent in `data.results`

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

If `exec` fails before launch because the agent is missing, prefer the structured preflight guidance in the JSON result. It includes both `suggestedEnsureCommand` and a rerun command with `--install if-missing`.

### Configuration and diagnosis

```bash
quantex config
quantex config get defaultPackageManager
quantex config set defaultPackageManager npm
quantex doctor --json
quantex upgrade --check --json
```

Use:

- `config` for CLI policy and defaults (`defaultPackageManager`, `networkTimeoutMs`, `selfUpdateChannel`, `selfUpdateRegistry`)
- `doctor` for environment or recovery diagnosis, especially when another agent should consume structured remediation hints
- `upgrade` for Quantex itself, not downstream agents

## High-value global flags

These flags matter most in agent workflows:

- `--json`
- `--non-interactive`
- `--yes`
- `--quiet`
- `--dry-run`
- `--refresh`
- `--timeout <duration>`

## Heuristics

- If another system will parse the result, use `--json`.
- If timing is uncertain, add `--timeout`.
- If cached version data would be misleading, add `--refresh`.
- If you need a stable command inventory, read `commands --json` instead of hard-coding assumptions.
