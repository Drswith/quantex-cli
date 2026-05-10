## 1. Core Implementation

- [x] 1.1 Add Cargo to managed install types, package metadata, install-method helpers, and installer capability classification.
- [x] 1.2 Add Cargo availability detection and Cargo installer implementation.
- [x] 1.3 Wire Cargo into managed installer lookup, install/update/uninstall execution, and batch update grouping.
- [x] 1.4 Render Cargo install commands and expose Cargo availability in `capabilities` and `doctor`.

## 2. Tests

- [x] 2.1 Add or update unit coverage for Cargo installer behavior, command rendering, update planning, and diagnostics.
- [x] 2.2 Add a Cargo-managed lifecycle smoke scenario for sandbox/container validation without requiring a real catalog agent to support Cargo first.
- [x] 2.3 Add DeepSeek TUI as a real existing catalog agent with a Cargo install method and validate its Cargo path through the sandbox smoke harness.

## 3. Validation

- [x] 3.1 Run `bun run openspec:status -- --change add-cargo-package-manager`.
- [x] 3.2 Run `bun run openspec:validate`.
- [x] 3.3 Run `bun run lint`, `bun run format:check`, `bun run typecheck`, and `bun run test`.
