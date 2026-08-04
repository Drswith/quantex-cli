# Output Contracts

Use this file when you need to consume Quantex output programmatically, explain the difference between human mode and agent mode, or automate Quantex from another agent, script, or automation layer.

## Automation stance

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

## Output modes

Quantex supports three surface modes:

- `human`
- `json`
- `ndjson`

### Human mode

Optimized for terminal reading:

- concise summaries
- color when enabled
- human-oriented phrasing

Use this for direct terminal workflows, not for parsing.

### JSON mode

Use:

```bash
quantex inspect codex --json
quantex capabilities --json
```

In JSON mode:

- `stdout` contains one final structured result
- `stderr` contains logs, warnings, and installer chatter

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
- `runId`
- `timestamp`
- `fetchedAt`
- `staleAfter`
- `source`

### NDJSON mode

Use:

```bash
quantex update --all --output ndjson
```

In NDJSON mode:

- `stdout` contains one structured event per line
- `stderr` remains the place for logs and installer output

Prefer NDJSON for long-running operations where incremental progress matters more than a single final blob.

## Non-interactive and non-TTY behavior

Quantex is `human-friendly + agent-friendly`.

Agent-friendly defaults apply when:

- `--json` is used
- `--output json` is used
- `--output ndjson` is used
- `--non-interactive` is used
- `stdin` or `stdout` is not a TTY

When `stdin` or `stdout` is non-TTY:

- interactivity is disabled
- the default surface becomes structured

Even with this auto-switching behavior, explicit flags are still recommended in automation.

## Stream contract

### What to parse

- parse `stdout`
- treat `stderr` as logging and operational noise, not as the contract surface

### What not to assume

- do not parse human-readable colors or spacing
- do not infer schemas from one sample run
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

In structured modes, failure information lives in:

- `error.code`
- `error.message`
- optionally `exitCode`

Check `ok` first, then inspect `error`.

When the exact command envelope matters, use:

```bash
quantex schema --json
quantex schema inspect --json
```

This is the preferred way to understand output structure without guessing.

## Recommended automation pattern

```bash
quantex inspect codex --json --non-interactive
quantex ensure codex --json --non-interactive --yes --idempotency-key ensure-codex-001
quantex exec codex --install never -- --help
```

Use:

- `--run-id` for correlation
- `--timeout` to bound runtime
- `--refresh` or `--no-cache` when freshness matters

### Safe command patterns

Check state before mutating:

```bash
quantex inspect claude --json
quantex ensure claude --json --non-interactive --yes
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

- Use `--idempotency-key` on mutating commands (`install`, `ensure`, `update`, `uninstall`, `upgrade`) so retries return the prior result instead of repeating side effects.
- Use `--timeout` to bound operations; timeout and cancellation map to stable error handling.
- Use `--run-id` or `QUANTEX_RUN_ID` to correlate JSON envelopes, NDJSON progress streams, and logs.

## Discovery-first automation

Before automating against a command you have not seen before, discover the live surface instead of relying on stale assumptions about flags, schema refs, output modes, or install policies:

```bash
quantex commands --json
quantex schema --json
quantex capabilities --json
```

## Practical guidance

- Parse `stdout`, not `stderr`.
- Prefer `inspect`, `ensure`, `resolve`, and `exec` over scraping `list` or `info`.
- Prefer `exec` over shortcut commands in automation.
- Use `doctor` when the question is "why is this environment broken?" rather than "what can I do?"
- When using `quantex doctor --json`, prefer `data.issues[].suggestedAction`, `suggestedCommands`, and `docsRef` over scraping warning prose.
