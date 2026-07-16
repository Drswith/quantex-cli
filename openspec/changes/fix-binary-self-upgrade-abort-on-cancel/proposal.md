## Why

Binary self-upgrade downloads the release asset with a bare `fetch()` and never registers a CLI cancellation handler. When `quantex upgrade --timeout` fires, Quantex emits TIMEOUT but the stalled download keeps the process alive and can still replace the binary after the command has already reported failure.

## What Changes

- Abort the binary self-upgrade download when CLI cancellation/timeout handlers run.
- Keep fail-closed network error reporting when the download is aborted.
- Do not change managed (bun/npm) self-upgrade cancellation or Windows delayed-swap semantics beyond stopping in-flight download work.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `self-upgrade`: Binary self-upgrade MUST abort in-flight release downloads when the CLI context is cancelled by timeout or signal.

## Impact

- Code: `src/self/binary.ts`, `test/self-binary.test.ts`
- Behavior: `quantex upgrade --timeout` for binary installs can terminate stalled downloads and exit instead of hanging
- Intake classification: observable upgrade timeout/cancel behavior → OpenSpec required before implementation
