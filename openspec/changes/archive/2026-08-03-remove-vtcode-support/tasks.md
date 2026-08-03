## 1. Catalog and public contract

- [x] 1.1 Remove the VTCode source catalog entry and regenerate all catalog-derived artifacts.
- [x] 1.2 Remove VTCode public and compatibility exports and assert that lookup no longer resolves it.

## 2. Current documentation and tests

- [x] 2.1 Remove VTCode from current supported-agent documentation and support matrices while retaining historical records.
- [x] 2.2 Remove VTCode-specific test coverage and replace generic provider fixtures with neutral package names.

## 3. Validation

- [x] 3.1 Run focused catalog and command tests plus the required validation suite, documenting the unrelated `self-state` timeout.
- [x] 3.2 Validate the OpenSpec change and review the generated diff for complete current-surface removal.
