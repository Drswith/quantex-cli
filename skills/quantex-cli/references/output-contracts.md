# Output Contracts

Use this file when you need to consume Quantex output programmatically, explain the difference between human mode and agent mode, or automate Quantex from another agent, script, or automation layer.

## Automation stance

Treat Quantex as a lifecycle CLI with a stable surface, not as a workflow engine.

Good fits:

- make sure an agent is available
- inspect or resolve an agent before invoking it
- update or uninstall a managed agent
- discover supported commands
- run a supported agent through `quantex exec`

Not mainline fits:

- multi-step plan/apply orchestration
- batch workflow routing across many tools
- daemonized control-plane behavior

## Output modes

Quantex has two output modes: human (the default) and JSON (`--json`).

### Human mode

Optimized for terminal reading:

- concise summaries
- color when enabled
- human-oriented phrasing

Use this for direct terminal workflows, not for parsing.

### JSON mode

Use:

```bash
quantex info codex --json
quantex update --all --json
```

In JSON mode:

- `stdout` contains one final structured result
- `stderr` contains logs, warnings, installer output, and the output of an agent run through `exec`

The result is an envelope with fields such as:

- `ok`
- `action`
- `target`
- `data`
- `warnings`
- `error`
- `meta`

Typical `meta` fields include:

- `schemaVersion`
- `version`
- `timestamp`
- `fetchedAt`
- `staleAfter`
- `source`

## Non-interactive and non-TTY behavior

Quantex is `human-friendly + agent-friendly`.

Structured output is selected only by `--json`.

Interactivity is disabled when:

- `--non-interactive` is used
- `stdin` or `stdout` is not a TTY

Human output stays the default on non-TTY streams, so pass `--json` in automation.

## Stream contract

### What to parse

- parse `stdout`
- treat `stderr` as logging and operational noise, not as the contract surface

### What not to assume

- do not parse human-readable colors or spacing
- do not infer fields from one sample run of a different command
- do not assume shortcut execution has the same surface guarantees as `exec`

## Shortcut vs exec

### `quantex <agent>`

- human-first shortcut
- convenient for local interactive use
- not the preferred automation entrypoint

### `quantex exec <agent> -- [args...]`

- explicit, agent-safe execution entrypoint
- clearer install policy
- avoids argument-boundary ambiguity with downstream agent flags

## Error and exit semantics

In JSON mode, failure information lives in:

- `error.code`
- `error.message`
- optionally `error.details` and `exitCode`

Check `ok` first, then inspect `error`. Argument errors (an unknown option, a missing argument, an invalid value) are reported the same way, as `INVALID_ARGUMENT` with exit code 2.

| Exit code | Error codes |
|---|---|
| 0 | none (success) |
| 1 | `INSTALL_FAILED`, `UPDATE_FAILED`, `UNINSTALL_FAILED`, `UNINSTALL_UNMANAGED`, `UPGRADE_FAILED`; also `upgrade --check` when an update exists (`ok: true`, `exitCode: 1`) |
| 2 | `INVALID_ARGUMENT` |
| 3 | `AGENT_NOT_FOUND` |
| 4 | `AGENT_NOT_INSTALLED` |
| 6 | `NETWORK_ERROR` |
| 7 | `INTERACTION_REQUIRED` |
| 8 | `MANUAL_ACTION_REQUIRED` |
| 9 | `RESOURCE_LOCKED` |
| 10 | `TIMEOUT` |
| 11 | `CANCELLED` |
| 12 | `STATE_READ_ERROR` |

Once an agent runs, `quantex exec` exits with the agent's own exit code.

## Recommended automation pattern

```bash
quantex info codex --json --non-interactive
quantex install codex --json --non-interactive --yes
quantex exec codex --install never -- --help
```

Use:

- `--timeout` to bound runtime
- `--refresh` when freshness matters

### Safe command patterns

Check state before mutating:

```bash
quantex info claude --json
quantex install claude --json --non-interactive --yes
```

Resolve before delegating to another runner that needs the absolute binary path or install source:

```bash
quantex resolve codex --json
```

Execute with explicit install policy, and never mix downstream flags with Quantex flags before the `--` separator:

```bash
quantex exec codex --install never -- --help
quantex exec codex --install if-missing -- --help
```

### Reliability controls

- `install`, `update`, and `uninstall` are safe to retry. An agent that is already installed, already current, or already removed is reported without changes (`changed: false`, or an `ALREADY_INSTALLED` warning).
- Use `--timeout` to bound operations; timeout and cancellation map to stable error handling.

## Discovery-first automation

Before automating against a command you have not seen before, discover the live surface instead of relying on stale assumptions about commands, flags, or install policies:

```bash
quantex commands --json
```

## Practical guidance

- Parse `stdout`, not `stderr`.
- Prefer `info --json`, `resolve`, and `exec` over scraping human output.
- Prefer `exec` over shortcut commands in automation.
- Use `doctor` when the question is "why is this environment broken?" rather than "what can I do?"
- When using `quantex doctor --json`, prefer `data.issues[].suggestedAction`, `suggestedCommands`, and `docsRef` over scraping warning prose.
