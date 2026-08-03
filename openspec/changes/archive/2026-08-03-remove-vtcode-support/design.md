## Context

The source catalog is the authoritative supported-agent list. Its manifest generator derives the TypeScript catalog data, named agent exports, support metadata, and Core discovery/mutation projections. VTCode is also named directly in public and v1 compatibility export modules, static documentation, and focused tests.

## Goals / Non-Goals

**Goals:**

- Remove VTCode from every current supported-agent surface derived from the catalog.
- Preserve the historical changelog and archived OpenSpec records as historical evidence rather than rewriting history.
- Assert the new negative lookup and export contract in focused tests.

**Non-Goals:**

- Uninstall an existing user-managed `vtcode` binary or erase lifecycle state records.
- Change Cargo provider behavior; its generic test fixtures will use a neutral non-VTCode package.
- Alter support for any other agent or introduce a VTCode migration/compatibility alias.

## Decisions

### Remove the source catalog entry and regenerate projections

Delete `src/agents/catalog/vtcode.json`, then run the repository catalog generator. This keeps generated artifacts in sync with their source and ensures Core catalog projections stop accepting VTCode.

Directly editing generated files was rejected because it would leave the source catalog and future generation output inconsistent.

### Remove explicit public and compatibility exports

Delete named `vtcode` exports from the public agent/root surfaces and the v1 compatibility module, then update the root-export compatibility fixture. This makes removal consistent for TypeScript consumers as well as CLI users.

Keeping a deprecated export was rejected because it would continue to advertise VTCode as a supported lifecycle entry and retain a breakable public contract.

### Keep historical records intact

Only current documentation changes. Changelog entries and archived OpenSpec artifacts retain their historical descriptions of when VTCode support was introduced or used.

## Risks / Trade-offs

- [Existing scripts or API consumers import `vtcode`] → This is an intentional breaking removal; lookup will fail and exports will be absent after the next release.
- [Generated projections drift from the catalog] → Regenerate them using the repository's `agent-catalog:generate` script and test the catalog-derived surfaces.
- [An installed VTCode state record remains] → Quantex will no longer manage it; the user retains the binary and state until they choose to remove them manually.
