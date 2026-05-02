## Why

A correctness bug in the shared command runtime allowed `Promise.race` to return a timeout or signal cancellation while the underlying command promise continued and later ran post-success finalization (idempotency persistence and passive self-upgrade notice side effects). That can mis-record outcomes and corrupt operator expectations for `--timeout` and cancellation.

## What Changes

- After timeout or cancellation wins the race, late settlement of the command promise MUST NOT persist idempotency records or run post-success hooks tied to a successful completion.

## Capabilities

### Modified Capabilities

- `cli-command-runtime`: Finalization after timeout/cancellation is aligned with the returned command result.

## Impact

- Affected code: `src/command-runtime.ts`, tests under `test/command-runtime.test.ts`.
