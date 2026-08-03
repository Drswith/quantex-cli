## Why

The human-readable `qtx list` inventory currently suppresses installation provenance even though Quantex has already recorded it. Users cannot quickly distinguish managed `bun`/`npm` installs from script, binary, or PATH-only discoveries without inspecting each agent, while the existing long-form labels would make a narrow table wrap again.

This change makes the ownership signal visible without returning verbose per-row source evidence to the default list.

## What Changes

- Add a compact optional `Source` column to human-readable `qtx list` and `qtx ls` output.
- Render short, truthful source tokens for managed install types and `script`, `binary`, or untracked `PATH` discoveries; keep package names and full source evidence in `qtx inspect <agent>`.
- Give the responsive table an explicit priority so it removes optional columns before uncontrolled wrapping on narrow terminals.
- Preserve the existing JSON and NDJSON list contracts unchanged.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `human-readable-output`: list inventory column priorities and the amount of installation-source information presented by default.

## Impact

- `src/commands/list.ts` human renderer and its focused tests.
- `openspec/specs/human-readable-output/spec.md` after the implementation is accepted.
- No installer behavior, persisted state, or machine-readable output changes.
