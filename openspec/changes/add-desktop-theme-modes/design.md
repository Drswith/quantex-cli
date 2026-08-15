## Context

The default shadcn stylesheet already defines light tokens under `:root` and dark tokens under `.dark`, but Desktop never applies the dark class. Desktop-only preferences are persisted by the Rust host as one typed object and mirrored by the deterministic browser client, so appearance belongs in that existing boundary rather than Quantex CLI configuration.

## Goals / Non-Goals

**Goals:**

- Persist `system`, `light`, or `dark` as a Desktop-only preference with `system` as the default.
- Apply the corresponding default shadcn token set to the whole document.
- React to macOS appearance changes only while `system` is selected.
- Offer the same preference from the header and Desktop settings without modifying generated shadcn primitives.
- Preserve compatibility with preference files written before the appearance field existed.

**Non-Goals:**

- Define custom color tokens, component variants, or a Quantex-specific theme.
- Add per-page themes, schedules, accent colors, or CLI configuration fields.
- Change the native background scheduler or CLI bridge.

## Decisions

1. Add a typed `appearance` field to the existing Desktop preference object. Rust gives the new field a serde default of `system`, allowing existing persisted JSON to load without migration failure. A separate preference store was rejected because it would create two native sources of truth.
2. Keep theme resolution in a small React-side utility. It toggles only the document root `.dark` class and `color-scheme`, reusing the official default shadcn tokens verbatim, while Tauri's built-in app theme API keeps native window chrome aligned. Adding a theme framework dependency was rejected because three modes need no extra provider or theme implementation.
3. Observe `prefers-color-scheme` with `matchMedia` only for `system`. Fixed `light` and `dark` modes remove that listener, so system appearance changes cannot override an explicit selection.
4. Persist both header and settings selections through the same `update_preferences` IPC. The browser preview uses the same typed client method and deterministic default.
5. Keep the generated shadcn component files unchanged. Theme controls compose the existing Button, Dropdown Menu, Label, and Select primitives.

## Risks / Trade-offs

- [Saved fixed mode becomes visible after preferences load] → Apply the system default immediately, then apply the persisted preference as soon as the local native read completes; no network request is involved.
- [Older preference files omit appearance] → Use serde field defaulting and cover deserialization in Rust tests.
- [System media-query APIs differ in tests] → Keep theme resolution in dependency-free functions with an injectable media-query result and focused Vitest coverage.

## Migration Plan

Existing Desktop state files load with `appearance: system`. The next preference save writes the new field. Rolling back leaves an unknown extra JSON field, which serde ignores by default.

## Open Questions

None.
