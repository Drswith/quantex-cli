## Context

`listCommand` already projects a full `sourceLabel` for every agent and preserves it in the v1 structured envelope. The human renderer omits that field because its current labels include ownership wording and package names, which are too wide for an inventory table. The shared table renderer already selects optional columns by priority before truncating required columns.

## Goals / Non-Goals

**Goals:**

- Make managed installation provenance scannable in a sufficiently wide human list.
- Preserve accurate distinction between recorded installation methods and an executable merely detected on `PATH`.
- Degrade deterministically at narrow widths and retain the complete evidence in `inspect`.
- Leave JSON and NDJSON payloads untouched.

**Non-Goals:**

- Infer installation provenance not represented by the recorded state.
- Add package names, executable paths, or installation commands to list rows.
- Change installation, update, ownership, or state persistence behavior.

## Decisions

- Derive a presentation-only token from the existing `sourceLabel`: recorded managed installations use their install type, unmanaged records use `script` or `binary`, and an untracked executable uses `PATH`. This avoids a new probe and prevents the UI from claiming that a PATH-only executable came from a specific manager.
- Keep the `Source` column optional and place it after `Version`. At widths that fit all declared columns, it is visible. The shared responsive renderer removes optional columns before line wrapping; `Update` remains the first column removed, and compact source evidence does not displace identity or installation status.
- Keep the full `sourceLabel` and `qtx inspect <agent>` as the detail surface. A compact inventory token answers ownership at a glance without losing the source/package evidence required for troubleshooting.

## Risks / Trade-offs

- [A short token hides package identity] → The existing inspect hint and unchanged structured `sourceLabel` provide the full evidence.
- [A PATH executable might look managed] → Render `PATH`, never infer `bun`/`npm` from the executable location in this view.
- [One additional wide-terminal column crowds the table] → Use the shared optional-column selection rather than wrapping or forcing the column at narrow widths.

## Migration Plan

The renderer change is backward compatible for machine consumers. Rollback consists of removing the presentation-only column and its delta specification; state and JSON payloads require no migration.

## Open Questions

None.
