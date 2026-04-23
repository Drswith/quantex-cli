# Runbook: Quantex Troubleshooting

## Purpose

Provide a canonical diagnostic and recovery path when Quantex fails, behaves unexpectedly, or produces output that is hard to automate against.

## When to use

- a command failed and it is unclear whether the problem is configuration, environment, install source, or command choice
- structured output is hard to parse or looks polluted
- an automation run is blocked by prompts, stale data, timeouts, or lock conflicts

## Inputs

- `quantex capabilities --json`
- `quantex commands --json`
- `quantex inspect <agent> --json`
- `quantex resolve <agent> --json`
- `quantex doctor`

## Triage order

Prefer this order:

1. `quantex capabilities --json`
2. `quantex commands --json`
3. `quantex inspect <agent> --json`
4. `quantex resolve <agent> --json` when the binary path itself matters
5. `quantex doctor` when the question becomes diagnostic or recovery-oriented

Why this order:

- `capabilities` tells you what this environment can do
- `commands` and `schema` tell you what contract the CLI supports
- `inspect` tells you how Quantex sees the specific agent
- `resolve` tells you what executable Quantex would actually launch
- `doctor` is for diagnosing what is wrong and how to recover

## Common failure patterns

### The command prompted during automation

Symptoms:

- an unexpected confirmation prompt appears
- a script hangs waiting for input

What to do:

- add `--non-interactive`
- add `--yes` if the operation should auto-confirm
- prefer `quantex exec <agent> -- [args...]` over shortcut execution
- use `--json` or `--output ndjson` when another system is consuming the result

Quantex also auto-switches to agent-friendly defaults when `stdin` or `stdout` is not a TTY, but explicit flags are still safer in automation.

### Structured output was polluted or hard to parse

Symptoms:

- mixed logs and JSON on the same stream
- parsers fail on color or installer output

What to do:

- parse `stdout`, not `stderr`
- use `--json` for final structured results
- use `--output ndjson` for long-running progress streams
- consult `skills/quantex-cli/references/output-contracts.md` for the exact stream rules

### The agent exists in PATH but Quantex cannot manage it

Symptoms:

- `list` or `inspect` shows a detected binary
- update behavior is limited or manual

What to do:

- inspect the install source with `quantex inspect <agent> --json`
- check whether the source is `managed`, `self-update`, or `manual-hint`
- use `quantex info <agent>` or `quantex doctor` for recovery hints

Detected-in-PATH is not the same thing as Quantex having a tracked managed install source.

### `resolve` failed

Symptoms:

- `quantex resolve <agent>` returns an error

What to do:

- run `quantex inspect <agent> --json` first
- if the agent is not installed, use `quantex ensure <agent>`
- if the agent is installed but unresolved, use `quantex doctor`

### Install or update failed because no installer is available

Symptoms:

- missing package manager or platform support
- errors such as installer unavailable or manual action required

What to do:

- run `quantex capabilities --json`
- check `installers`
- inspect the current platform and supported install methods
- if this is expected, choose a different install source or follow the manual hint

### Data looks stale

Symptoms:

- version or release data seems old
- recent releases are not reflected

What to do:

- add `--refresh`
- or add `--no-cache`
- check `meta.fetchedAt`, `meta.staleAfter`, and `meta.source`

### A retry may repeat side effects

Symptoms:

- you are retrying `install`, `ensure`, `update`, `uninstall`, or `upgrade`

What to do:

- add `--idempotency-key`
- reuse the same key when retrying the same intended operation

### An operation timed out or was cancelled

Symptoms:

- timeout or cancellation errors
- long-running install or update appears interrupted

What to do:

- rerun with a larger `--timeout` if appropriate
- add `--run-id` so logs and outputs correlate cleanly
- keep `--idempotency-key` on mutating retries

Quantex maps timeout and signal cancellation into stable lifecycle behavior and terminates managed child processes according to its runtime policy.

### Concurrent operations conflicted

Symptoms:

- lock conflict errors
- multiple agents or shells manipulating Quantex state at once

What to do:

- wait for the other operation to finish
- avoid overlapping `install`, `uninstall`, `update`, or `upgrade` calls against the same state

Quantex protects lifecycle state with resource locks; lock conflicts are a sign to serialize work, not to bypass the error.

## Recovery

### Need a safe minimal diagnostic snapshot

```bash
quantex capabilities --json
quantex inspect codex --json
quantex doctor
```

### Need to recover from stale state assumptions

```bash
quantex inspect codex --json --refresh
quantex resolve codex --json
```

### Need to retry a mutating command safely

```bash
quantex ensure codex --json --non-interactive --yes --idempotency-key ensure-codex-001 --timeout 2m
```

## Escalation

Stop and ask for human input when:

- recovery requires changing install source or release channel unexpectedly
- repeated retries suggest a permission, platform, or environment mismatch rather than transient failure
- troubleshooting reveals a missing product contract that should be written down before implementation continues

## Related artifacts

- `docs/adr/0001-agent-native-project-memory.md`
- `skills/quantex-cli/references/output-contracts.md`
- `autonomy/tasks/qtx-0001-migrate-troubleshooting-into-runbooks.md`
