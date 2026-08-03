## Why

VTCode support was removed prematurely in #554, which also made the next
release a breaking major. Restore the supported lifecycle contract without
rewriting protected `main` history or discarding later unrelated work.

## What Changes

- Restore VTCode as a built-in supported lifecycle agent, including catalog
  projections, public exports, compatibility exports, current documentation,
  and contract tests.
- Revert only the behavior introduced by #554; preserve subsequent list,
  release-artifact, and test changes.
- Keep #554 and its archived OpenSpec record as historical evidence rather
  than rewriting repository history.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-catalog`: Reinstate VTCode as a supported lifecycle agent and restore
  its lookup, installation, inspection, update, execution, and export contract.

## Impact

The source catalog, generated catalog projections, public and v1 compatibility
exports, current support documentation, and catalog-derived tests change. No
release tag, GitHub Release, or npm publication is created by this change.
