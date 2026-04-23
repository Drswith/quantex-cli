# Automation Playbook

Use this file when Quantex is being consumed by another agent, script, or automation layer.

## Preferred automation stance

Treat Quantex as a lifecycle CLI with a stable surface, not as a workflow engine.

Good fits:

- ensure an agent is available
- inspect or resolve an agent before invoking it
- update or uninstall a managed agent
- discover supported commands and output schemas
- run a supported agent through `quantex exec`

Not mainline fits:

- multi-step plan/apply orchestration
- batch workflow routing across many tools
- daemonized control-plane behavior

## Output contract

### Human mode

- optimized for terminal reading
- may use color and concise summaries

### JSON mode

Use:

```bash
quantex inspect codex --json
```

Expect:

- structured result on `stdout`
- logs and installer chatter on `stderr`
- envelope fields such as `ok`, `action`, `data`, `error`, `warnings`, `meta`

### NDJSON mode

Use:

```bash
quantex update --all --output ndjson
```

Prefer this for long-running work where incremental progress matters.

## Non-interactive behavior

Use `--non-interactive` when prompts are unsafe.

Quantex also auto-switches to agent-friendly defaults when `stdin` or `stdout` is not a TTY. That means:

- interactivity is disabled
- default output becomes structured

Still prefer explicit flags in automation because they make intent obvious.

## Safe command patterns

### Check state before mutating

```bash
quantex inspect claude --json
quantex ensure claude --json --non-interactive --yes
```

### Resolve before delegating to another runner

```bash
quantex resolve codex --json
```

Use this when another system needs the absolute binary path or install source.

### Execute with explicit install policy

```bash
quantex exec codex --install never -- --help
quantex exec codex --install if-missing -- --help
```

Never mix downstream flags with Quantex flags before the `--` separator.

## Reliability controls

### Idempotency

Use `--idempotency-key` on mutating commands such as:

- `install`
- `ensure`
- `update`
- `uninstall`
- `upgrade`

This lets retries return the prior result instead of repeating side effects.

### Timeout

Use `--timeout` to bound operations:

```bash
quantex ensure gemini --json --timeout 90s
```

Quantex maps timeout and cancellation to stable error handling and will terminate managed child processes according to its lifecycle policy.

### Run correlation

Use `--run-id` or `QUANTEX_RUN_ID` when you want to correlate:

- JSON envelopes
- NDJSON progress streams
- logs

## Discovery-first automation

If you are about to automate against a command you have not seen before, do this first:

```bash
quantex commands --json
quantex schema --json
quantex capabilities --json
```

This avoids depending on stale assumptions about flags, schema refs, output modes, or install policies.

## Practical guidance

- Parse `stdout`, not `stderr`.
- Prefer `inspect`, `ensure`, `resolve`, and `exec` over scraping `list` or `info`.
- Prefer `exec` over shortcut commands in automation.
- Use `doctor` when the question is "why is this environment broken?" rather than "what can I do?"
- When using `quantex doctor --json`, prefer `data.issues[].suggestedAction`, `suggestedCommands`, and `docsRef` over scraping warning prose.
