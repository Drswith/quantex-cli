# Task 10 Report: Normalize npm, Bun, And mise Catalog Entries

## Result

OpenSpec `4.10` is complete. Every npm, Bun, and mise install method now binds its provider, exact target identity, target kind, and declared probes in the source candidate. Twenty-four catalog files were migrated; duplicate `packages.npm` and `packages.mise` keys were removed wherever a normalized candidate owns that identity.

npm and Bun candidates declare executable, package-presence, installed-version, and target-version probes. mise candidates declare executable, package-presence, and installed-version probes without fabricating target-version resolution.

## Compatibility projection

- The catalog adapter reconstructs legacy npm/mise package maps from normalized candidates.
- Normalized npm/Bun/mise candidates project back to the historical type-only method shapes.
- Existing AgentDefinition objects, root exports, command formatting, installation, state, and update paths remain unchanged.
- Legacy metadata on entries without an npm/Bun/mise candidate was deliberately left for its owning migration group.

## Validation

- Focused catalog/schema/compatibility/package-manager/update suite: 6 files / 202 tests passed.
- Full suite: 78 files / 874 tests passed.
- Catalog manifest and public JSON schema regenerated successfully with no public-schema content change.
- lint: 0 warnings / 0 errors.
- format check, typecheck, OpenSpec 16/16, and memory check passed.

## Scope retained

- Cargo, Deno, pip, uv, Homebrew, winget, script, and binary source candidates remain for their dedicated migration tasks.
- OpenSpec `4.2` remains unchecked pending final first-party conformance closure.
