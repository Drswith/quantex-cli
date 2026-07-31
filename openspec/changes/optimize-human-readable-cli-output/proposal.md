## Why

Quantex human-readable output currently exposes too many equally weighted fields on a single line and uses fixed padding that does not reflect the actual dataset or terminal width. Commands such as `qtx ls` therefore wrap unpredictably, lose column alignment, and make the most important lifecycle state harder to scan.

## What Changes

- Introduce shared human-output layout primitives for visible-width-aware padding, compact tables, labeled details, wrapping, and terminal-width detection.
- Redesign `qtx list` / `qtx ls` around a compact, aligned summary that prioritizes agent name, installation state, version, and update mode while moving verbose source evidence out of the default row.
- Apply the same visual hierarchy and width-aware behavior to other human-readable inventory, diagnostic, discovery, and detail commands where long rows or manually aligned labels currently reduce readability.
- Preserve JSON and NDJSON payloads, schemas, exit codes, command behavior, and detailed machine-readable evidence unchanged.
- Add focused rendering tests for alignment, ANSI-aware width, narrow-terminal degradation, wrapping, and machine-output isolation.

## Capabilities

### New Capabilities

- `human-readable-output`: Defines responsive, visually aligned, information-prioritized human CLI presentation while preserving explicit paths to full detail.

### Modified Capabilities

None.

## Impact

- Affects human rendering in `src/commands/` and introduces reusable presentation helpers under `src/output/`.
- Adds focused ANSI/Unicode display-width dependencies without adding a table or terminal-UI framework.
- Adds human-output snapshot/assertion coverage under `test/`.
- Does not change command data models, JSON/NDJSON serialization, schemas, lifecycle operations, persisted state, or provider behavior.
