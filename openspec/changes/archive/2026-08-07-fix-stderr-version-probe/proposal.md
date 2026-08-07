## Why

Some supported agent CLIs, including Pi, report a successful version probe on stderr instead of stdout. Quantex currently treats an empty stdout stream as an unknown installed version, so `qtx list` and `qtx inspect` lose reliable version evidence even though the executable is installed and the probe succeeded.

This is an observable CLI behavior change requested as a continuation of the investigated `qtx upgrade`/listing issue, so it passes the OpenSpec intake gate before implementation.

## What Changes

- Parse a successful version probe from stdout first.
- When stdout does not yield a version, parse stderr as an independent fallback.
- Preserve stdout precedence when both streams contain version-like output.
- Keep non-zero probe exits unsuccessful, and do not concatenate stdout and stderr before parsing.
- Apply the same fallback contract to the core observation path and the shared installed-version path.
- Add regression coverage for stderr-only output, stdout precedence, custom parsers, and non-zero exits.

Non-goals:

- Do not merge provider/package version evidence into PATH executable inspection.
- Do not add a Pi-specific probe or managed-package fallback.
- Do not change version comparison, install-source identity, update strategy, or structured output fields.

## Capabilities

### New Capabilities

- `agent-version-probing`: define how successful installed-agent version probes select and parse stdout/stderr evidence.

### Modified Capabilities

- (none)

## Impact

- `src/utils/version.ts` shared installed-version probing
- `src/core/production-observation.ts` core PATH executable inspection
- `test/utils/version.test.ts` and `test/core/production-observation.test.ts`
- New version-probing OpenSpec capability and its implementation tasks
- No dependency, public schema, or state-file changes
