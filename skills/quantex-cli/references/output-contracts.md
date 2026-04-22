# Output Contracts

Use this file when you need to consume Quantex output programmatically or explain the difference between human mode and agent mode.

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
