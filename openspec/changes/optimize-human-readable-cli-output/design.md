## Context

Quantex already separates human rendering from the JSON/NDJSON result envelope, but each command currently hand-builds its own spacing and line structure. The screenshot that motivated this change shows the main failure mode: `list` emits five pieces of information with fixed name padding, so real source labels and versions produce ragged rows or terminal-driven wrapping. Similar fixed labels, unbounded comma-separated lists, and long diagnostic sentences exist across read-only commands.

The runtime is Bun, but the repository's supported Bun line does not expose a consistent runtime implementation of its newly declared `stringWidth`, `sliceAnsi`, and `wrapAnsi` APIs. Quantex therefore uses the focused `string-width`, `slice-ansi`, and `wrap-ansi` packages, which understand ANSI styling, CJK characters, emoji, and terminal display width without introducing a table framework.

## Goals / Non-Goals

**Goals:**

- Make default human output easy to scan at common terminal widths and intentionally readable on narrow terminals.
- Keep columns aligned by visible terminal width rather than JavaScript string length.
- Establish a shared visual grammar for headings, compact tables, labeled detail rows, summaries, hints, and wrapped prose.
- Prioritize operationally useful summary fields while keeping a clear command path to full detail.
- Preserve machine-readable contracts exactly.

**Non-Goals:**

- Add a full terminal UI, interactive pager, configuration surface, or third-party table framework.
- Change lifecycle observation, command result data, schemas, exit codes, or persisted state.
- Force all output into tables; mutation progress and one-line success/failure messages remain sentence-oriented.
- Guarantee no wrapping in terminals narrower than the minimum readable content width.

## Decisions

### Use small shared rendering primitives

Add a human-output module that returns lines for:

- responsive tables with required and optional columns;
- aligned label/value fields with hanging indentation;
- ANSI- and Unicode-aware truncation and wrapping;
- terminal width resolution with a conservative non-TTY fallback.

Renderers remain responsible for semantic choices and colors. This keeps the helper small and avoids turning presentation into a parallel component framework.

Alternative considered: use a third-party table library. Rejected because focused display-width primitives are sufficient, while a table framework would add more bundle weight and still require Quantex-specific responsive behavior. Bun's matching built-ins were also considered, but the supported runtime does not yet provide them consistently despite their presence in installed type declarations.

### Prefer progressive disclosure over dense default rows

`list` will show the registered agent name plus concise installation/version/update columns. Source evidence such as `managed via bun (@scope/package)` is removed from the default inventory row and remains available through `qtx inspect <agent>` and unchanged structured output. A summary and explicit detail hint make that path visible.

Other broad catalogs follow the same rule: `capabilities` reports the registered-agent count and points to `qtx list`; `commands` prioritizes command and summary and points to JSON/schema discovery for machine-contract detail.

Alternative considered: truncate every field in place. Rejected because silent truncation preserves density while hiding meaning; dropping low-priority columns with an explicit detail path produces a more honest summary.

### Adapt columns to available width

Table columns declare whether they are required. The renderer measures natural visible width, then removes optional columns from lowest to highest priority until the table fits. Required cells are truncated with an ellipsis only when the remaining width is genuinely too small. Read-only detail views wrap values with hanging indentation instead of relying on terminal auto-wrap.

The initial `list` hierarchy is:

1. agent name and installed state;
2. installed version;
3. update mode.

This gives a four-column view on typical terminals, a two- or three-column view on narrower terminals, and a bounded required-column fallback at extreme widths.

### Limit command migration to output that benefits materially

Migrate inventory/catalog/diagnostic/detail renderers (`list`, `capabilities`, `commands`, `schema`, `doctor`, `info`, `inspect`, and `resolve`) to the shared grammar. Keep install/ensure/update/uninstall/upgrade progress renderers sentence-oriented because their sequential status messages are already concise and semantically different from tabular data.

### Test pure layout and representative commands

Export the pure layout functions for deterministic unit tests at explicit widths. Add representative command tests for `list` wide/narrow output and confirm JSON remains byte-structure-compatible through existing compatibility coverage. Refresh only the human golden hashes affected by intentional presentation changes.

## Risks / Trade-offs

- [Human output changes can surprise scripts that incorrectly parse it] → Preserve JSON/NDJSON exactly and include explicit structured-output hints where useful; human output remains presentation, not a stable parser contract.
- [Terminal width can be absent or inaccurate when redirected] → Use a conservative fallback width and keep all line generation deterministic.
- [ANSI or wide Unicode can break naïve alignment] → Use Bun's display-width-aware primitives and cover colored/CJK cells in tests.
- [Progressive disclosure can look like lost information] → Keep installed state explicit, include summaries and detail hints, and leave all data available through detail commands and structured output.
- [Migrating every renderer at once creates unnecessary churn] → Limit the first change to broad read-only and diagnostic surfaces with demonstrated density/alignment problems.

## Migration Plan

1. Add and unit-test the shared human layout module.
2. Migrate `list` and add width-specific rendering coverage.
3. Migrate the selected read-only catalog, diagnostic, and detail renderers.
4. Run focused tests, refresh intentional human compatibility goldens, then run the full validation suite.

Rollback is a source-level revert of the renderers and helper; no data or state migration is involved.

## Open Questions

None. The initial thresholds and column priorities are implementation details covered by deterministic rendering tests and can be tuned without changing machine contracts.
