## Why

The default `qtx ls` table labels an update-management strategy as `Update`,
which makes a row such as `managed` look like an available-update result.
The command already observes latest-version metadata, but its human output
does not expose that availability signal.

## What Changes

- Rename the human-readable `Update` column in `qtx list` / `qtx ls` to
  `Managed` so it clearly describes the selected update path.
- Add an optional `Available` column that presents a newer observed version
  when one can be determined, without claiming availability for unknown or
  non-comparable version pairs.
- Preserve the existing responsive column-priority behavior and leave JSON
  and NDJSON output unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `human-readable-output`: Default list output distinguishes update management
  from available newer versions.

## Impact

Affected human renderer and its tests: `src/commands/list.ts` and list/output
rendering coverage. The stable JSON and NDJSON payloads remain unchanged.
