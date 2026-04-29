## Context

Quantex models agent discovery through static catalog entries. This change only adjusts naming metadata that users and machine consumers see during lookup or inspection; it does not alter install methods, binaries, or update commands.

## Goals / Non-Goals

**Goals:**

- Keep the catalog aligned with the intended upstream-facing names for Kilo, Qoder, and Qwen.
- Preserve the existing `qoder` canonical slug while allowing lookup by the published binary name `qodercli`.
- Stop advertising the legacy `qwen-code` alias through Quantex lookup surfaces.

**Non-Goals:**

- Changing install methods, package metadata, binaries, or self-update behavior.
- Renaming canonical agent slugs.
- Expanding the catalog with new agents.

## Decisions

- Use `Kilo CLI` as the Kilo display name so Quantex matches the shorter product-facing name already used in the implementation change.
- Add `qodercli` as a lookup alias instead of renaming the canonical slug from `qoder`, because the existing Quantex command surface remains `qtx qoder` while the upstream executable is `qodercli`.
- Remove `qwen-code` from `lookupAliases` so Quantex only resolves Qwen through the canonical `qwen` identifier.

## Risks / Trade-offs

- [Lookup compatibility] Removing `qwen-code` can break callers that still resolve Qwen through the legacy alias. → Mitigation: record the alias removal in the catalog spec and update tests so the change is explicit and intentional.
- [Doc drift] README tables and tests can lag behind catalog metadata. → Mitigation: update product-facing tables and registry assertions in the same change.

## Migration Plan

- Update the agent definitions and associated assertions.
- Sync the README supported-agent tables with the new names.
- Validate with lint, format, typecheck, tests, and OpenSpec validation.

## Open Questions

- None.
