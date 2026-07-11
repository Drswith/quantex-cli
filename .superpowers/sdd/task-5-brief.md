# Task 5 Brief: Migrate Cargo And Deno Adapters

## Objective

Migrate Cargo and Deno to typed adapters while preserving Cargo argument ordering/forced reinstall and Deno global-install arguments/executable-name uninstall semantics. Route both maintained `ManagedInstaller` entries through typed compatibility projections.

## Boundary

- Reuse the typed system-package adapter and shared legacy-operation helper.
- Cargo target arguments follow the crate name; update inserts `--force` before configured arguments.
- Deno install arguments precede the package reference; update adds `--force`; uninstall uses `binaryName` when bound.
- Default presence remains indeterminate rather than fabricated.
- Do not touch pip/uv/mise, capabilities, catalog, commands, or state.

## Completion

- Add failing provider and compatibility tests first.
- Run Cargo/Deno conformance, existing low-level tests, package-manager/update compatibility, and full gates.
- Mark only OpenSpec `4.5`, keep `4.2` unchecked, report, and checkpoint commit.
