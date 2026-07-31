## 1. Shared human layout

- [x] 1.1 Implement ANSI- and Unicode-aware terminal width, responsive table, field, wrapping, and truncation helpers.
- [x] 1.2 Add deterministic unit coverage for wide and narrow tables, optional-column priority, colored cells, CJK width, wrapped fields, and terminal-width fallback.

## 2. Inventory and catalog presentation

- [x] 2.1 Redesign `list` / `ls` human output with aligned responsive columns, concise lifecycle values, a summary, and an explicit inspect hint.
- [x] 2.2 Redesign `capabilities`, `commands`, and `schema` human output around compact tables and progressive-disclosure hints.

## 3. Diagnostic and detail presentation

- [x] 3.1 Redesign `doctor` human output with aligned installer and installed-agent summaries plus width-bounded issue guidance.
- [x] 3.2 Migrate `info`, `inspect`, and `resolve` to shared aligned fields and wrapped command/path details.

## 4. Compatibility and validation

- [x] 4.1 Add or update representative command-rendering tests and refresh only intentional human compatibility goldens.
- [x] 4.2 Run focused tests, `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, and `bun run openspec:validate`.
- [x] 4.3 Review the live CLI at representative wide and narrow terminal widths and record final OpenSpec and delivery-closure state.
