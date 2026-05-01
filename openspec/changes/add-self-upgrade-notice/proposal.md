## Why

Implementation requested work-intake classification: this change modifies observable human CLI behavior for self-upgrade awareness, so it requires OpenSpec before file edits.

Quantex can already tell a user whether a newer CLI version exists when they explicitly run `quantex upgrade --check` or `quantex doctor`, but users running older installs have no lightweight reminder during normal management flows. That leaves release adoption dependent on manual checking even when Quantex already knows how to detect a newer version.

## What Changes

- Add a human-mode self-upgrade notice that can appear after successful Quantex management commands when the current CLI version is behind the installable latest version.
- Gate the notice so it does not affect JSON or NDJSON output, `--quiet`, or explicit self-upgrade and doctor flows that already surface upgrade state.
- Persist lightweight reminder state so Quantex does not repeat the same notice on every command invocation.

## Capabilities

### New Capabilities

- `self-upgrade-notice`: Human-mode reminder behavior for outdated Quantex installs, including throttling and output-mode gating.

### Modified Capabilities

- `self-upgrade`: Human-mode self-upgrade surfaces now include a passive reminder path outside explicit `upgrade` and `doctor` commands.

## Impact

- Affected code: `src/command-runtime.ts`, `src/self/`, `src/state/`, and related tests.
- Affected specs: new `self-upgrade-notice` capability and a delta to `self-upgrade`.
- No structured output, schema version, or command catalog changes are intended.
