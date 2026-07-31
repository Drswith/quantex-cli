## Why

The bounded Core `install` and `ensure` paths have passed the differential, provider, state, package, sandbox, cancellation, and cross-platform gates required by the staged transition. Keeping their production selector permanently on the legacy implementation would retain two mutation paths without gaining another compatibility signal.

## What Changes

- Promote the existing Core route to the stable apply default for CLI `install` and `ensure` only, while retaining legacy v1 `--dry-run` planning.
- Retain an explicit `QUANTEX_INSTALLATION_ENGINE=legacy` whole-invocation compatibility escape route through the 1.5 soak period.
- Keep selection before any lifecycle work, prohibit post-side-effect fallback, and keep route data out of v1 human, JSON, and NDJSON output.
- Document the 1.4 routing state and the bounded escape route in both product READMEs and the staged-compatibility ADR.
- Do not change the state schema, CLI syntax, public SDK surface, `update`, `uninstall`, `run`, or release workflow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `compatibility-contract`: Promote the bounded Core route while preserving pre-invocation rollback, v1 contracts, and staged removal gates.
- `product-readme`: Document the current Core-routing stage without misrepresenting the independent SDK release path.

## Impact

- Affects the internal selector used by `install` and `ensure`, focused routing tests, the compatibility specification, ADR 0007, and English/Simplified Chinese READMEs.
- This is a release-worthy compatible minor behavior change; it deliberately has no external runtime dependency or persisted-state migration.
