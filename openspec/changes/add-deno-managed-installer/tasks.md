## 1. Core Implementation

- [x] 1.1 Add Deno to managed install types, package metadata, install-method helpers, catalog schema, and installer capability classification.
- [x] 1.2 Add Deno availability detection and Deno installer implementation for install, update, batch update, and uninstall.
- [x] 1.3 Wire Deno into managed installer lookup, install/update/uninstall execution, state persistence, latest-version inspection fallback, and batch update grouping/order.
- [x] 1.4 Render Deno install commands and expose Deno availability in `capabilities`, `doctor`, and command schema output.

## 2. Catalog and Documentation

- [x] 2.1 Migrate at least one verified supported agent definition to include Deno managed install metadata when the upstream package is compatible with Deno global install.
- [x] 2.2 Update product-facing docs and public skill references affected by the new managed installer key.

## 3. Tests

- [x] 3.1 Add or update unit coverage for Deno installer commands, command rendering, update planning, grouped updates, uninstall, diagnostics, and schema output.
- [x] 3.2 Add or update catalog coverage for any agent definition with Deno metadata.
- [x] 3.3 Add Deno-managed fake lifecycle smoke coverage.

## 4. Validation and Delivery

- [x] 4.1 Run `bun run openspec:status -- --change add-deno-managed-installer`.
- [x] 4.2 Run `bun run openspec:validate`.
- [x] 4.3 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 4.4 Commit, push, and create a PR with a body file validated by `bun run pr:body:check`.
