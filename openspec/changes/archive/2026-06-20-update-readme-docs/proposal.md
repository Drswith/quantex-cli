## Why

The product README has drifted from the current CLI surface: the supported-agent table is missing recently added catalog entries, and the configuration example no longer reflects the built-in defaults. Because README onboarding is a product-facing contract, the update needs an OpenSpec-backed documentation change.

## What Changes

- Refresh `README.md` and `README.zh-CN.md` so supported-agent references match the current CLI catalog.
- Correct configuration examples and prose so `selfUpdateRegistry` is documented as optional and unset by default.
- Keep the README guidance aligned with existing `qtx` / `quantex`, agent skill, no-install, and mise installer expectations.
- No CLI behavior, schemas, install providers, or package dependencies change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `product-readme`: clarify that product README examples must reflect current agent catalog entries and built-in configuration defaults.

## Impact

- Affected files: product README docs and the `product-readme` OpenSpec delta for this change.
- Validation: docs/OpenSpec checks plus the repository baseline lint, format check, typecheck, and test commands required by the runtime.
