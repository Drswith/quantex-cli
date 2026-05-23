## 1. Core Implementation

- [x] 1.1 Add mise to managed install types, package metadata, catalog schema, command rendering, and installer capability classification.
- [x] 1.2 Add mise availability detection and installer implementation for install, update, batch update, uninstall, and best-effort installed-version parsing.
- [x] 1.3 Wire mise into managed installer lookup, install/update/uninstall execution, latest-version inspection fallback, and batch update grouping/order.
- [x] 1.4 Expose mise availability in `capabilities`, `doctor`, and doctor schema output.
- [x] 1.5 Allow `defaultPackageManager` to normalize and validate `mise`.

## 2. Catalog and Docs

- [x] 2.1 Add Codex CLI mise package metadata and managed mise install methods on supported platforms.
- [x] 2.2 Regenerate checked-in catalog manifest and schema outputs.
- [x] 2.3 Update product README configuration guidance for mise without expanding self-upgrade scope.

## 3. Tests

- [x] 3.1 Add unit coverage for mise installer commands, installed-version parsing, command rendering, source recording, update, grouped updates, uninstall, diagnostics, and schema output.
- [x] 3.2 Add catalog/config coverage for Codex mise metadata and `defaultPackageManager = mise`.

## 4. Validation and Delivery

- [x] 4.1 Run `bun run openspec:status -- --change add-mise-support`.
- [x] 4.2 Run `bun run openspec:validate`.
- [x] 4.3 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
- [x] 4.4 Commit, push, and create a PR with a body file validated by `bun run pr:body:check`.
